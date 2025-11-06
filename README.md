# BGG Kallax Organizer

A web application to help organize your BoardGameGeek collection into IKEA Kallax cube organizers.

## Features

- 🎲 Fetches your BoardGameGeek collection using the BGG XML API2
- 📦 Calculates optimal packing into Kallax cubes (13" W × 13" H × 15" D)
- 🔄 Drag-and-drop sorting priorities
- 📊 Visual 2D front view and list view of each cube
- ⚙️ Choose between vertical or horizontal stacking
- 🎯 Includes community data for best player count and community age recommendations

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn
- BoardGameGeek API Token (see setup below)

### Installation

#### Step 1: Download BGG Logo (Required)

BGG's API Terms of Use require displaying a "Powered by BGG" logo:

1. Visit https://drive.google.com/drive/folders/1kNOSZi8qUAVhU38CNpdfnNKGS-WnBUGS
2. Download `powered_by_BGG_02_MED.png` (or any size you prefer)
3. Save it as `public/powered_by_bgg.png` in the project folder
4. The logo will automatically appear in the footer

#### Step 2: Get Your BGG API Token

1. Visit https://boardgamegeek.com/applications
2. Log in with your BGG account
3. Register a new application (name it whatever you like, e.g., "My Kallax Organizer")
4. Wait for approval (usually quick, but may take some time)
5. Once approved, generate an API token

#### Step 3: Set Up Backend Server

1. Install backend dependencies:
```bash
cd server
npm install
```

2. Create a `.env` file in the `server` directory:
```bash
# Create the .env file from the example
cp env.example.txt .env
```

3. Edit `server/.env` and add your BGG API token:
```
BGG_API_TOKEN=your_actual_token_here
PORT=3001
```

4. Start the backend server:
```bash
npm start
# Or for auto-reload during development:
npm run dev
```

The server will run on http://localhost:3001

#### Step 4: Set Up Frontend

1. In a new terminal, navigate back to the project root
2. Install frontend dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically `http://localhost:5173`)

### Building for Production

#### Backend:
```bash
cd server
npm start
```

Set environment variables on your hosting platform (e.g., Heroku, Railway, Render):
- `BGG_API_TOKEN`: Your BGG API token
- `PORT`: (optional, usually set by hosting platform)

#### Frontend:
```bash
npm run build
```

The production-ready files will be in the `dist` directory.

**Important**: Set the `VITE_API_URL` environment variable to your deployed backend URL before building:
```bash
VITE_API_URL=https://your-backend-url.com/api npm run build
```

## How to Use

1. **Enter your BGG Username**: Type your BoardGameGeek username in the input field

2. **Choose Options**:
   - Check "Include pre-ordered games" if you want to include games you've pre-ordered
   - Check "Include expansions" if you want to pack expansions (by default, only base games are included)
   - Select stacking preference (vertical = standing upright, horizontal = laying flat)

3. **Configure Sorting Priorities**:
   - Drag items to reorder priority (higher = more important)
   - Check/uncheck items to enable/disable them
   - When multiple games fit in a cube, the highest priority enabled field determines which game is chosen

4. **Click "Organize Collection"**: The app will:
   - Fetch your owned games from BGG
   - Get detailed information including dimensions
   - Calculate the optimal packing arrangement
   - Display visual results

## How It Works

### Expansion Filtering

- By default, **expansions are excluded** from packing
- Many expansions are small (single cards, tokens) and don't need cube space
- You can include expansions via checkbox if you have large standalone expansions
- BGG API identifies items with `subtype="boardgameexpansion"`

### Dimension Handling

- Game dimensions are extracted from BGG's version data
- Prefers the most recent English version with dimensions
- Falls back to any version with dimensions (newest to oldest)
- Assumes 13"×13"×2" if no dimensions found (marked with ⚠️)

### Packing Algorithm

1. Games are oriented based on stacking preference:
   - Longest dimension → 15" depth axis (can exceed)
   - **Vertical**: 2nd longest → height, shortest → width
   - **Horizontal**: 2nd longest → width, shortest → height

2. Bin-packing algorithm:
   - Primary goal: Minimize number of cubes needed
   - Secondary: When multiple games fit, choose by sorting priority
   - Respects 13" width and height constraints

### Sorting Options

- **Game Name (Alphabetical)**: Sort games alphabetically by name
- **Categories**: BGG game categories
- **Families**: BGG families (includes themes)
- **BGG Rank**: Overall BoardGameGeek ranking
- **Min/Max Players**: Player count range
- **Best Player Count**: Community-voted best player count
- **Min/Max Playtime**: Playtime range in minutes
- **Age**: Publisher's recommended age
- **Community Age**: Community-suggested age
- **Weight**: Game complexity (1-5 scale)
- **BGG Rating**: Average BGG rating

## API Rate Limiting

The app respects BoardGameGeek's API rate limits by:
- Batching requests (up to 20 game IDs per request)
- Adding delays between batches
- Showing progress updates during data fetching

## Architecture

This application uses a client-server architecture:

- **Frontend (React + Vite)**: User interface running in the browser
- **Backend (Express)**: Proxy server that securely communicates with BGG API
  - Keeps your BGG API token secure (not exposed to users)
  - Handles rate limiting and error handling
  - Runs on port 3001 by default

## Technologies Used

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **@dnd-kit** - Drag-and-drop functionality
- **Axios** - HTTP requests

### Backend
- **Express** - Web server framework
- **Axios** - HTTP client for BGG API
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### Data Source
- **BoardGameGeek XML API2** - Game data (requires authentication as of April 2025)

## Known Limitations

- Some games may not have dimensions in BGG's database
- API requests can take time for large collections
- BGG API occasionally returns 202 (still processing) - retry if this happens
- Games with depths > 15" will protrude from cubes (but won't fit in 13" anyway)
- Requires BGG API token (need to register application at boardgamegeek.com)

## Troubleshooting

### "BGG API token not configured" error
- Make sure you created `server/.env` file with your `BGG_API_TOKEN`
- Restart the backend server after adding the token

### 401 Unauthorized error
- Your BGG API token may be invalid or expired
- Generate a new token at https://boardgamegeek.com/applications

### Backend won't start
- Make sure you're in the `server` directory when installing dependencies
- Check that port 3001 isn't already in use
- Verify your `.env` file is in the `server` directory

### Frontend can't connect to backend
- Make sure the backend is running on port 3001
- Check browser console for CORS errors
- Verify `VITE_API_URL` is set correctly if using a custom backend URL

## License

MIT

## Credits

Data provided by [BoardGameGeek](https://boardgamegeek.com)

