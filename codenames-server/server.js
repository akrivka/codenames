import betterSqlite3 from "better-sqlite3";
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import { tinyws } from 'tinyws';

// enums
const CardType = {
    RED: "red",
    BLUE: "blue",
    NEUTRAL: "neutral",
    ASSASSIN: "assassin"
}

export const Team = {
    RED: "red",
    BLUE: "blue"
}

export const Role = {
    OPERATIVE: "operative",
    SPYMASTER: "spymaster"
}

// LOAD WORDLIST
const wordlist = fs.readFileSync("wordlist.txt", "utf-8").split("\n");

// LOAD BOARDS
const cardTypeEncoding = {
    "R": CardType.RED,
    "B": CardType.BLUE,
    "N": CardType.NEUTRAL,
    "A": CardType.ASSASSIN
}
const boards = fs.readFileSync("board.txt", "utf-8")
    .split("\n")
    .map(line => line.split(" ").map(char => cardTypeEncoding[char]));

// SQLITE
console.log("connecting to database");
const db = betterSqlite3("codenames.db");
db.pragma(`journal_mode = WAL`);
db.exec(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY ,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    ended INTEGER NOT NULL DEFAULT 0
)`)

// SERVER
const serverOptions = {
    // key: fs.readFileSync('key.pem'),
    // cert: fs.readFileSync('cert.pem')
}

const app = express()
app.use(tinyws())

const wsClients = new Set();

app
    .use(bodyParser.urlencoded({ limit: "200mb", extended: false }))
    .use(cors({ origin: "*" }))
    .use("/join-room/:roomName", async (req, res) => {
        if (!req.ws) return res.status(400).send("no websocket");

        const roomName = req.params.roomName;
        const team = req.query.team;

        let room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);
        if (room == undefined) {
            return res.status(404).send("room not found");
        }

        console.log(`joining room ${roomName}`)

        const ws = await req.ws();
        wsClients.add({ roomId: room.id, team, ws });

        const broadcast = (roomId, type, data) => {
            for (const { roomId: r, ws } of wsClients) {
                if (r === roomId) {
                    ws.send(JSON.stringify({ type, data }));
                }
            }
        }

        // sending initial state
        ws.send(JSON.stringify({ type: "update-state", data: { state: room.state, roomId: room.id } }));

        ws.on("message", async (msg) => {
            const { type, roomId, team, ...data } = JSON.parse(msg);

            console.log("received message", type, roomId, team, data)
            room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);
            let state = JSON.parse(room.state);
            let changeTurn = false;

            // add message to log
            state.log.unshift({ team, type, data });

            switch (type) {
                case "reveal-card": {
                    const { word } = data;

                    // find and reveal card
                    const card = state.cards.find(card => card.word === word);
                    card.revealed = true;

                    // check if we opened the assassin
                    if (card.type === CardType.ASSASSIN) {
                        state.ended = true;
                    }

                    // if we 
                    //   - opened a neutral card or the other team's card, or
                    //   - it was the last guess
                    // change turn
                    if (card.type !== state.turn.team || parseInt(state.turn.param) == 1) {
                        changeTurn = true
                    } else {
                        // decrease number of remaining guesses
                        state.turn.param = parseInt(state.turn.param) - 1;
                    }

                    break
                }
                case "end-turn": {
                    changeTurn = true;
                    break
                }
                case "submit-hint": {
                    const { clue, number } = data;

                    state.hints[team].push({ clue, number });
                    state.turn.param = parseInt(number) + 1;

                    changeTurn = true;
                    break
                }
            }

            if (changeTurn) {
                switch (state.turn.role) {
                    case Role.SPYMASTER:
                        state.turn.role = Role.OPERATIVE;
                        break
                    case Role.OPERATIVE:
                        state.turn.role = Role.SPYMASTER;
                        state.turn.team = state.turn.team === Team.RED ? Team.BLUE : Team.RED;
                        state.turn.param = 0;
                        break
                }
            }

            db.prepare(`UPDATE rooms SET state = ? WHERE id = ?`)
                .run(JSON.stringify(state), roomId)

            console.log("update-state", type, roomId, team, state.turn)
            broadcast(roomId, "update-state", { state: JSON.stringify(state) })
        })

        ws.on("close", () => {
            wsClients.delete(ws);
        })

    })
    .post("/create-room", async (req, res) => {
        const roomName = req.query.roomName
        console.log(`entering room ${roomName}`)

        // check if roomname is taken
        let room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);

        if (room == undefined) {
            // choose 25 random words from wordlist
            const words = wordlist.sort(() => Math.random() - 0.5).slice(0, 25);

            // choose board
            const boardIndex = Math.floor(Math.random() * boards.length);
            const board = boards[boardIndex];

            // define cards
            const cards = words.map((word, i) => ({
                word,
                type: board[i],
                revealed: false
            }))

            const state = {
                cards,
                hints: { red: [], blue: [] },
                turn: { team: Team.RED, role: Role.SPYMASTER, param: 0 },
                log: []
            }

            db.prepare(`INSERT INTO rooms (name, state) VALUES (?, ?)`)
                .run(roomName, JSON.stringify(state))

            room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);
        }

        res.send(JSON.stringify(room));
    })

const port = 8000
app.listen(port, () => {
    console.log(`listening on port ${port}`)
})
//const server = https.createServer(app)
//const port = 8000
//server.listen(port, () => {
//    console.log(`listening on port ${port}`)
//})