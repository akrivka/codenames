import betterSqlite3 from "better-sqlite3";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import fs from "fs";
import { tinyws } from "tinyws";

// enums
const CardType = {
  RED: "red",
  BLUE: "blue",
  WILD: "wild",
  NEUTRAL: "neutral",
  ASSASSIN: "assassin",
};

export const Team = {
  RED: "red",
  BLUE: "blue",
};

export const Role = {
  OPERATIVE: "operative",
  SPYMASTER: "spymaster",
};

// Constants
const MAX_ROOM_NAME_LENGTH = 50;
const MAX_HINT_LENGTH = 100;
const MAX_CODE_LENGTH = 50;
const PORT = process.env.PORT || 8000;

// Helper functions
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

function validateRoomName(roomName) {
  if (!roomName || typeof roomName !== "string") {
    throw new Error("Room name is required");
  }
  if (roomName.length > MAX_ROOM_NAME_LENGTH) {
    throw new Error(
      `Room name must be less than ${MAX_ROOM_NAME_LENGTH} characters`,
    );
  }
  if (!/^[a-zA-Z0-9-_]+$/.test(roomName)) {
    throw new Error(
      "Room name can only contain letters, numbers, hyphens, and underscores",
    );
  }
  return roomName.trim();
}

function validateTeam(team) {
  if (!team || (team !== Team.RED && team !== Team.BLUE)) {
    throw new Error("Invalid team");
  }
  return team;
}

function sanitizeString(str, maxLength) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLength);
}

// LOAD WORDLIST
let wordlist;
try {
  wordlist = fs
    .readFileSync("wordlist.txt", "utf-8")
    .split("\n")
    .filter((w) => w.trim());
  log("info", "Wordlist loaded", { count: wordlist.length });
} catch (error) {
  log("error", "Failed to load wordlist", { error: error.message });
  process.exit(1);
}

// SQLITE
let db;
try {
  log("info", "Connecting to database");
  db = betterSqlite3("codenames.db");
  db.pragma(`journal_mode = WAL`);
  db.exec(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        ended INTEGER NOT NULL DEFAULT 0
    )`);
  log("info", "Database initialized");
} catch (error) {
  log("error", "Database initialization failed", { error: error.message });
  process.exit(1);
}

// SERVER
const app = express();
app.use(tinyws());

// WebSocket client management - store by roomId -> Set of clients
const wsClients = new Map();

// Helper to add client to room
function addClientToRoom(roomId, client) {
  if (!wsClients.has(roomId)) {
    wsClients.set(roomId, new Set());
  }
  wsClients.get(roomId).add(client);
  log("info", "Client joined room", {
    roomId,
    clientCount: wsClients.get(roomId).size,
  });
}

// Helper to remove client from room
function removeClientFromRoom(roomId, client) {
  const clients = wsClients.get(roomId);
  if (clients) {
    clients.delete(client);
    if (clients.size === 0) {
      wsClients.delete(roomId);
      log("info", "Room emptied", { roomId });
    } else {
      log("info", "Client left room", { roomId, clientCount: clients.size });
    }
  }
}

// Helper to broadcast to all clients in a room
function broadcast(roomId, type, data) {
  const clients = wsClients.get(roomId);
  if (!clients) return;

  const message = JSON.stringify({ type, data });
  const deadClients = [];

  for (const client of clients) {
    try {
      if (client.ws.readyState === 1) {
        // OPEN
        client.ws.send(message);
      } else {
        deadClients.push(client);
      }
    } catch (error) {
      log("error", "Failed to send message to client", {
        error: error.message,
      });
      deadClients.push(client);
    }
  }

  // Clean up dead connections
  deadClients.forEach((client) => removeClientFromRoom(roomId, client));
}

app
  .use(bodyParser.urlencoded({ limit: "200mb", extended: false }))
  .use(bodyParser.json())
  .use(cors({ origin: "*" }))
  .use("/join-room/:roomName", async (req, res) => {
    try {
      if (!req.ws) return res.status(400).send("no websocket");

      const roomName = validateRoomName(req.params.roomName);
      const team = validateTeam(req.query.team);

      let room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);
      if (!room) {
        return res.status(404).send("room not found");
      }

      log("info", "Client joining room", { roomName, team });

      const ws = await req.ws();
      const client = { ws, team, roomId: room.id };
      addClientToRoom(room.id, client);

      // sending initial state
      ws.send(
        JSON.stringify({
          type: "update-state",
          data: { state: room.state, roomId: room.id },
        }),
      );

      // client sends message to server
      ws.on("message", async (msg) => {
        try {
          const parsed = JSON.parse(msg);
          const { type, roomId, team, ...data } = parsed;

          // Validate inputs
          if (!roomId || !team) {
            log("warn", "Invalid message format", { type });
            return;
          }

          log("debug", "Message received", { type, roomId, team });

          room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId);
          if (!room) {
            log("warn", "Room not found", { roomId });
            return;
          }

          let state = JSON.parse(room.state);
          if (state.winner) {
            log("debug", "Game already ended", {
              roomId,
              winner: state.winner,
            });
            return;
          }

          switch (type) {
            case "submit-code": {
              const code = sanitizeString(data.code, MAX_CODE_LENGTH);
              if (!code) {
                log("warn", "Invalid code submitted", { roomId });
                return;
              }

              const card = state.cards.find(
                (card) =>
                  card.location != null &&
                  card.location.code.trim().toLowerCase() ===
                    code.toLowerCase(),
              );

              if (!card || card.revealed) {
                log("debug", "Card not found or already revealed", {
                  code,
                  roomId,
                });
                return;
              }

              card.revealed = team;

              // check win conditions
              const teamCards = (t) =>
                state.cards.filter(
                  (c) =>
                    (c.type == t && c.revealed) ||
                    (c.type == CardType.WILD && c.revealed == t),
                ).length;

              const teamScore = (t) => -state.hints[t].length;

              if (teamCards(Team.RED) >= 10 && teamCards(Team.BLUE) >= 10) {
                log("info", "Game ended", { roomId });
                if (teamScore(Team.RED) > teamScore(Team.BLUE)) {
                  state.winner = Team.RED;
                } else if (teamScore(Team.RED) < teamScore(Team.BLUE)) {
                  state.winner = Team.BLUE;
                } else {
                  state.winner = "draw";
                }
              }

              state.log.unshift({ team, type, data: { word: card.word } });
              break;
            }

            case "submit-hint": {
              const clue = sanitizeString(data.clue, MAX_HINT_LENGTH);
              const number = parseInt(data.number);

              if (!clue || isNaN(number) || number < 0) {
                log("warn", "Invalid hint submitted", { roomId, clue, number });
                return;
              }

              state.log.unshift({ team, type, data: { clue, number } });
              state.hints[team].unshift({ clue, number });
              break;
            }

            default:
              log("warn", "Unknown message type", { type, roomId });
              return;
          }

          db.prepare(`UPDATE rooms SET state = ? WHERE id = ?`).run(
            JSON.stringify(state),
            roomId,
          );

          broadcast(roomId, "update-state", { state: JSON.stringify(state) });
        } catch (error) {
          log("error", "Error processing message", {
            error: error.message,
            stack: error.stack,
          });
        }
      });

      ws.on("close", () => {
        log("info", "WebSocket closed", { roomId: client.roomId });
        removeClientFromRoom(client.roomId, client);
      });

      ws.on("error", (error) => {
        log("error", "WebSocket error", {
          error: error.message,
          roomId: client.roomId,
        });
        removeClientFromRoom(client.roomId, client);
      });
    } catch (error) {
      log("error", "Error in join-room handler", {
        error: error.message,
        stack: error.stack,
      });
      res.status(400).send(error.message);
    }
  })
  .post("/create-room", async (req, res) => {
    try {
      const roomName = validateRoomName(req.query.roomName);
      log("info", "Creating room", { roomName });

      // check if roomname is taken
      let room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);

      if (room) {
        log("info", "Room already exists", { roomName });
        return res.send(JSON.stringify(room));
      }

      // choose 25 random words from wordlist
      if (wordlist.length < 25) {
        throw new Error("Wordlist must contain at least 25 words");
      }

      const words = [...wordlist].sort(() => Math.random() - 0.5).slice(0, 25);

      // Load locations safely
      let locations = [];
      try {
        locations = JSON.parse(fs.readFileSync("locations.json", "utf-8")).sort(
          () => Math.random() - 0.5,
        );
      } catch (error) {
        log("error", "Failed to load locations", { error: error.message });
        // Continue without locations
      }

      // generate board, 9 red, 9 blue, 3 wild, 4 neutral
      const board = [
        ...Array(9).fill(CardType.RED),
        ...Array(9).fill(CardType.BLUE),
        ...Array(3).fill(CardType.WILD),
        ...Array(4).fill(CardType.NEUTRAL),
      ].sort(() => Math.random() - 0.5);

      // define cards
      const cards = words.map((word, i) => ({
        word,
        type: board[i],
        revealed: false,
        location: i < locations.length ? locations[i] : null,
      }));

      const state = {
        cards,
        hints: { red: [], blue: [] },
        log: [],
        winner: null,
      };

      db.prepare(`INSERT INTO rooms (name, state) VALUES (?, ?)`).run(
        roomName,
        JSON.stringify(state),
      );

      room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);

      log("info", "Room created", { roomName, roomId: room.id });
      res.send(JSON.stringify(room));
    } catch (error) {
      log("error", "Error creating room", {
        error: error.message,
        stack: error.stack,
      });
      res.status(400).send(error.message);
    }
  })
  .get("/get-locations", async (req, res) => {
    try {
      const locations = JSON.parse(fs.readFileSync("locations.json", "utf-8"));
      res.send(JSON.stringify(locations));
    } catch (error) {
      log("error", "Error reading locations", { error: error.message });
      res.status(500).send("Failed to read locations");
    }
  })
  .post("/update-locations", async (req, res) => {
    try {
      const locations = JSON.parse(req.body.locations);

      if (!Array.isArray(locations)) {
        throw new Error("Locations must be an array");
      }

      // Validate location structure
      for (const loc of locations) {
        if (!loc.code || typeof loc.code !== "string") {
          throw new Error("Invalid location format");
        }
      }

      fs.writeFileSync("locations.json", JSON.stringify(locations, null, 2));
      log("info", "Locations updated", { count: locations.length });

      res.send("success");
    } catch (error) {
      log("error", "Error updating locations", {
        error: error.message,
        stack: error.stack,
      });
      res.status(400).send(error.message);
    }
  });

// Graceful shutdown
process.on("SIGTERM", () => {
  log("info", "SIGTERM received, closing server");
  db.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  log("info", "SIGINT received, closing server");
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  log("info", "Server started", { port: PORT });
});
