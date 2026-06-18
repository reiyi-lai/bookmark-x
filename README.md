# Bookmark-X - Twitter Bookmark Organizer

Chrome extension that automatically organizes your Twitter/X bookmarks into categories via OpenAI API.

## Project Structure

```
Bookmark-X/
├── client/                    # React frontend (Vercel)
├── server/                    # Express.js backend (Railway)
├── chrome-extension/          # Chrome extension (Chrome Web Store)
├── shared/                    # Shared types and schemas
└── supabase/                  # Database config
```

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API (GPT-4o-mini)

## Setup

### Prerequisites

- Node.js
- npm
- Chrome browser

### Install

```bash
npm install
cd client && npm install
```

### Environment Variables

Root `.env`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
OPENAI_API_KEY=
```

`client/.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Run

```bash
# Start server + client together
npm run dev:all

# Or separately:
npm run dev:server    # API on http://localhost:3001
npm run dev:client    # Frontend on http://localhost:5173
```

### Chrome Extension

```bash
# Build for local dev (points to localhost)
npm run build:extension:dev

# Build for production (points to live servers)
npm run build:extension
```

Load in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension/dist`

### Supabase

```bash
npm run supabase:login          # Login
npm run supabase:link           # Link project
npm run supabase:push           # Apply migrations
npm run supabase:types          # Generate TypeScript types
```
