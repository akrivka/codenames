# Codenames Server

WebSocket-based server for the Codenames game.

## Features

- Real-time multiplayer gameplay via WebSockets
- SQLite database for persistent game state
- Location-based word mapping
- Team-based gameplay (Red vs Blue)
- Structured logging with JSON output
- Input validation and sanitization
- Graceful error handling
- Connection cleanup

## Installation

```bash
npm install
# or
pnpm install
```

## Configuration

Copy `.env.example` to `.env` and adjust settings:

```bash
cp .env.example .env
```

Configuration options:
- `PORT`: Server port (default: 8000)
- `DATABASE_PATH`: SQLite database file path
- `MAX_ROOM_NAME_LENGTH`: Maximum room name length
- `MAX_HINT_LENGTH`: Maximum hint/clue length
- `MAX_CODE_LENGTH`: Maximum location code length
- `CORS_ORIGIN`: CORS origin setting

## Running

```bash
node server.js
```

## API Endpoints

### WebSocket Endpoints

#### `GET /join-room/:roomName?team=red|blue`
Join a game room with WebSocket connection.

**Query Parameters:**
- `team`: Team to join (red or blue)

**Messages from client:**
```json
{
  "type": "submit-code",
  "roomId": 1,
  "team": "red",
  "code": "location-code"
}
```

```json
{
  "type": "submit-hint",
  "roomId": 1,
  "team": "red",
  "clue": "animals",
  "number": 3
}
```

**Messages from server:**
```json
{
  "type": "update-state",
  "data": {
    "state": "{...}",
    "roomId": 1
  }
}
```

### HTTP Endpoints

#### `POST /create-room?roomName=<name>`
Create a new game room.

**Response:**
```json
{
  "id": 1,
  "name": "room-name",
  "state": "{...}",
  "created_at": 1234567890,
  "ended": 0
}
```

#### `GET /get-locations`
Get all available locations for the game.

#### `POST /update-locations`
Update the locations configuration.

**Body:**
```json
{
  "locations": [
    { "code": "ABC123", "name": "Location Name", ... }
  ]
}
```

## Game State Structure

```javascript
{
  cards: [
    {
      word: "string",
      type: "red" | "blue" | "wild" | "neutral" | "assassin",
      revealed: false | "red" | "blue",
      location: { code: "ABC123", ... } | null
    }
  ],
  hints: {
    red: [{ clue: "string", number: 0 }],
    blue: [{ clue: "string", number: 0 }]
  },
  log: [
    { team: "red", type: "submit-hint", data: {...} }
  ],
  winner: null | "red" | "blue" | "draw"
}
```

## Database Schema

```sql
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  ended INTEGER NOT NULL DEFAULT 0
);
```

## Logging

All logs are output in JSON format with timestamps:

```json
{
  "timestamp": "2025-10-15T12:00:00.000Z",
  "level": "info",
  "message": "Server started",
  "port": 8000
}
```

Log levels: `info`, `warn`, `error`, `debug`

## Security Features

- Input validation and sanitization
- Room name restrictions (alphanumeric, hyphens, underscores only)
- Maximum length limits on all user inputs
- WebSocket connection cleanup
- Dead connection detection and removal
- SQL injection protection via prepared statements

## Room Name Validation

Room names must:
- Be 1-50 characters long
- Contain only letters, numbers, hyphens, and underscores
- Be unique

## Win Conditions

A team wins when both teams have revealed at least 10 cards. The winner is determined by:
1. Fewest hints given (negative score: -hints.length)
2. If tied, the game is a draw

## Error Handling

All endpoints include proper error handling:
- Invalid input returns 400 Bad Request
- Missing resources return 404 Not Found
- Server errors return 500 Internal Server Error
- All errors are logged with stack traces

## Development

The server uses:
- Express 5.0
- better-sqlite3 for database
- tinyws for WebSocket support
- body-parser for request parsing
- cors for cross-origin requests

## Graceful Shutdown

The server handles SIGTERM and SIGINT signals:
- Closes database connections
- Logs shutdown event
- Exits cleanly
