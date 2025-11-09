# Backend Server for BGCube

This Express server acts as a proxy for the BoardGameGeek XML API2, keeping your API token secure.

## Setup

1. Create a `.env` file in this directory:
```bash
cp env.example.txt .env
```

2. Edit `.env` and add your BGG API token:
```
BGG_API_TOKEN=your_actual_token_here
PORT=3001
```

3. Get your BGG API token:
   - Visit https://boardgamegeek.com/applications
   - Register your application
   - Wait for approval
   - Generate a token

## Running

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

## Endpoints

- `GET /api/health` - Health check and token status
- `GET /api/collection/:username` - Fetch user's collection
- `GET /api/thing` - Fetch game details

## Environment Variables

- `BGG_API_TOKEN` (required) - Your BGG API token
- `PORT` (optional) - Server port, defaults to 3001

