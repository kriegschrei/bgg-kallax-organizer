# Quick Setup Guide

## ⚠️ Important: BGG API Token Required

As of April 2025, BoardGameGeek requires API authentication. Follow these steps:

## Step-by-Step Setup

### 1. Download BGG Logo (Required)

BGG's API Terms of Use require displaying their logo:

1. Visit https://drive.google.com/drive/folders/1kNOSZi8qUAVhU38CNpdfnNKGS-WnBUGS
2. Download `powered_by_BGG_02_MED.png` (recommended)
3. Save it as `public/powered_by_bgg.png` in the project root
4. The app will display it in the footer automatically

### 2. Get Your BGG API Token

1. Go to https://boardgamegeek.com/applications
2. Log in with your BGG account
3. Click "Register New Application"
4. Fill in the form:
   - **Name**: "My Kallax Organizer" (or whatever you prefer)
   - **Description**: Personal board game organizer
   - **Website**: http://localhost:5173 (or your URL)
5. Submit and **wait for approval** (you'll get an email)
6. Once approved, go back to the applications page
7. Click on your application and **generate a token**
8. Copy the token (you'll need it in step 3)

### 3. Install Dependencies

```bash
# Install frontend dependencies (in project root)
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 4. Configure Backend

Edit the file `server/.env` and replace `your_token_here` with your actual BGG API token:

```
BGG_API_TOKEN=paste_your_actual_token_here
PORT=3001
```

### 5. Start the Application

Open **TWO terminal windows**:

**Terminal 1 - Backend Server:**
```bash
npm run server:dev
```

Wait until you see: `✅ BGG API token configured`

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 6. Use the Application

1. Open your browser to http://localhost:5173
2. Enter a BGG username (try "kriegschrei" or your own)
3. Configure your preferences
4. Click "Organize Collection"

## Troubleshooting

### "BGG API token not configured"
- Make sure your token is in `server/.env`
- Restart the backend server after adding the token

### 401 Unauthorized
- Your token might be invalid
- Check that you copied the entire token
- Generate a new token if needed

### Can't connect to backend
- Make sure backend is running on port 3001
- Check that both terminals are running
- Look for errors in the backend terminal

## Still Waiting for BGG Approval?

The backend server will start but won't work until you have a valid token. Once you receive approval:
1. Get your token from BGG
2. Add it to `server/.env`
3. Restart the backend server
4. You're ready to go!

