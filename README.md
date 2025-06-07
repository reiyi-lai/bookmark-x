# Bookmark-X - Twitter Bookmark Organizer

Bookmark-X helps you automatically organize your Twitter bookmarks into meaningful categories using ML-powered classification.

## 🚀 Project Structure

```
BookmarkBuddy/
├── client/                    # React frontend (deployed to Vercel)
├── server/                    # Express.js backend
├── chrome-extension/          # Chrome extension source
├── shared/                    # Shared types and schemas
└── supabase/                  # Database migrations and config
```

## 🚀 Soft Launch Plan (Target: June 6)

### UI Changes (2 days)
- **UI Enhancements (1-1.5 days)**
  - [x] Show total bookmark count
  - [ ] Display tweet author details (name, profile picture, username)
  - [ ] Expandable tweets with full content + media
  - [ ] Interactive loading screen with progress indicators
  - [ ] Fix dark mode for sidebar
  
- **Category System (0.5 days)**
  - [ ] Add new categories (startup/product ideas, research papers)
  - [ ] Combine overlapping categories
  - [ ] Refine existing categories

### ML Enhancements (2 days)
- [ ] Implement sentence-transformers via API
- [ ] Optimize 'job opportunities' classification (a more scoped category)
- [ ] Enhance categorization accuracy and differentiation

### Chrome Extension Build (3 days)
- [ ] Basic manifest and content script setup
- [ ] Twitter bookmark page detection
- [ ] One-click categorization
- [ ] Auth integration with main app

### User Management (2 days)
- [ ] Simple email-based signup flow (don't necessarily need password)
- [ ] Database schema updates
- [ ] User data persistence
- [ ] Basic account management

### Testing & Launch (1 day)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Rate limiting implementation (to manage initial load)
- [ ] Launch preparation

### Post June-6 (1 week)
- Think hard about distribution strategy

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Database**: Supabase (PostgreSQL)
- **ML**: currently DeepSeek, Embedding-based Similarity, TF-IDF + Keyword Matching
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

3. **Start development servers:**
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
cd client && npm run dev
```

4. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3000/api

### Production Deployment

#### Frontend (Vercel)
See detailed instructions in [`client/README.md`](./client/README.md)

1. Deploy the `/client` directory to Vercel
2. Framework preset: **Vite**
3. Root directory: `/client`
4. Auto-detected build settings work perfectly

#### Backend
Deploy the Express.js server to your preferred hosting provider:
- Railway
- Heroku  
- DigitalOcean
- AWS/GCP/Azure

#### Environment Configuration
The client automatically detects the environment:
- **Development**: API calls to `http://localhost:3000`
- **Production**: API calls to `https://bookmark-x.info`

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
cd chrome-extension
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load extension in Chrome:
   - Go to `chrome://extensions/` on Chrome
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `chrome-extension/dist` in project folder

## 📦 Build Commands

```bash
# Development
npm run dev                    # Start backend server
cd client && npm run dev       # Start frontend dev server

# Building
npm run build                  # Build entire monorepo
cd client && npm run build     # Build frontend only (for Vercel)
npm run build:extension        # Build Chrome extension

# Database
npm run supabase:*            # Various Supabase commands
```
