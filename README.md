# Bookmark-X - Twitter Bookmark Organizer

Bookmark-X is a Chrome extension that helps you automatically organize your Twitter bookmarks into meaningful categories using ML-powered classification.

## Project Structure

```
Bookmark-X/
├── client/                    # React frontend (deployed to Vercel)
├── server/                    # Express.js backend (deployed to Railway)
├── chrome-extension/          # Chrome extension source (pending approval by Chrome webstore)
├── shared/                    # Shared types and schemas
└── supabase/                  # Database migrations and config
```

## 🚀 Launch Plan

See ```plan.md``` for roadmap.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Database**: Supabase (PostgreSQL)
- **ML**: currently DeepSeek, TF-IDF + Keyword Matching
- **Authentication**: Supabase Auth

## 🔧 Setup and Installation

### Prerequisites

- Node.js
- npm
- Chrome browser (for extension development)

### Development Setup

1. **Install dependencies:**
```bash
# Install root dependencies (server, shared)
npm install

# Install client dependencies
cd client && npm install
```

2. **Set up environment variables:**
Create `.env` in root directory:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=

HUGGINGFACE_API_KEY=
```

Create `.env` in /client directory:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

3. **Start development servers:**
```bash
# Option 1: Run both server and client concurrently
npm run dev:all

# Option 2: Run server and client separately
# Terminal 1:
npm run dev:server

# Terminal 2:
npm run dev:client
```

4. **Access the application:**
- Frontend: http://localhost:3000
- API: http://localhost:3001/api

#### Environment Configuration
The client automatically detects the environment:
- **Development**: API calls to `http://localhost:3001`
- **Production**: API calls to `https://bookmark-x-production.up.railway.app`

### Supabase Setup

1. Login to Supabase account:
```bash
npm run supabase:login
```

2. Initialize Supabase:
```bash
npm run supabase:init
```

3. Link Supabase project:
```bash
npm run supabase:link
```

4. Apply database migration (if any):
```bash
npm run supabase:push
```

5. Generate TypeScript types from Supabase:
```bash
npm run supabase:types
```

### Chrome Extension Setup

1. Navigate to extension directory and install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
# For development (points to localhost servers)
npm run build:extension:dev

# For production (points to live servers)
npm run build:extension
```
Note: The development build connects to local servers (http://localhost:3001 for API and http://localhost:3000 for frontend), while the production build connects to the live servers.

3. Load extension in Chrome:
   - Go to `chrome://extensions/` on Chrome
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `chrome-extension/dist` in project folder

## 📦 Build Commands

```bash
# Development
npm run dev:server            # Start backend server only
npm run dev:client            # Start frontend dev server only
npm run dev:all              # Start both backend and frontend concurrently

# Chrome Extension
npm run build:extension:dev    # Build Chrome extension for development (localhost URLs)
npm run build:extension        # Build Chrome extension for production (live URLs)

# Database
npm run supabase:*            # Various Supabase commands
```

<!-- Test -->
