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
    WILD: "wild",
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

const wsClients = new Map();

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
        wsClients.set(room.id, [...(wsClients.get(room.id) || []), { ws, team }]);

        const broadcast = (roomId, type, data) => {
            for (const { ws } of wsClients.get(roomId)) {
                ws.send(JSON.stringify({ type, data }));
            }
        }

        // sending initial state
        ws.send(JSON.stringify({ type: "update-state", data: { state: room.state, roomId: room.id } }));

        // client sends message to server
        ws.on("message", async (msg) => {
            const { type, roomId, team, ...data } = JSON.parse(msg);
            const otherTeam = team === Team.RED ? Team.BLUE : Team.RED;

            console.log("received message", type, roomId, team, data)
            room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);
            let state = JSON.parse(room.state);
            if (state.winner) return;

            // add message to log

            switch (type) {
                case "submit-code": {
                    const { code } = data;

                    const card = state.cards.find(card => (card.location != null && card.location.code.trim().toLowerCase() === code.trim().toLowerCase()));
                    if (!card || card.revealed) return;
                    card.revealed = team;

                    // check win conditions
                    const teamCards = (team) => state.cards.filter((c) => (c.type == team && c.revealed) || (c.type == CardType.WILD && c.revealed == team)).length
                    const teamScore = (team) => -state.hints[team].length

                    if (teamCards(Team.RED) >= 10 && teamCards(Team.BLUE) >= 10) {
                        console.log("win!")
                        if (teamScore(Team.RED) > teamScore(Team.BLUE)) {
                            state.winner = Team.RED;
                        } else if (teamScore(Team.RED) < teamScore(Team.BLUE)) {
                            state.winner = Team.BLUE;
                        } else {
                            state.winner = "draw";
                        }
                    }


                    state.log.unshift({ team, type, data: { word: card.word } });

                    break
                }
                case "submit-hint": {
                    const { clue, number } = data;
                    state.log.unshift({ team, type, data });
                    state.hints[team].unshift({ clue, number });
                    break
                }
            }

            db.prepare(`UPDATE rooms SET state = ? WHERE id = ?`)
                .run(JSON.stringify(state), roomId)

            console.log("update-state", type, roomId, team)
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
            const locations = JSON.parse(fs.readFileSync("locations.json", "utf-8")).sort(() => Math.random() - 0.5);
            console.log(locations)

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
                location: i < locations.length ? locations[i] : null
            }))

            const state = {
                cards,
                hints: { red: [], blue: [] },
                // cob: remove
                // turn: { team: Team.RED, role: Role.SPYMASTER, param: 0 },
                log: [],
                winner: null
            }

            db.prepare(`INSERT INTO rooms (name, state) VALUES (?, ?)`)
                .run(roomName, JSON.stringify(state))

            room = db.prepare(`SELECT * FROM rooms WHERE name = ?`).get(roomName);
        }

        res.send(JSON.stringify(room));
    })
    .get("/get-locations", async (req, res) => {
        // read locations.json file
        const locations = JSON.parse(fs.readFileSync("locations.json", "utf-8"));

        // send locations
        res.send(JSON.stringify(locations));
    })
    .post("/update-locations", async (req, res) => {
        console.log(req.body.locations)
        const locations = JSON.parse(req.body.locations);

        // write locations.json file
        fs.writeFileSync("locations.json", JSON.stringify(locations));

        // return success
        res.send("success");
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