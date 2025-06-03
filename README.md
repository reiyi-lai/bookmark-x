# Bookmark-X - Twitter Bookmark Organizer

Bookmark-X helps you automatically organize your Twitter bookmarks into meaningful categories using ML-powered classification.

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

### Server and Web App Setup
1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env` file in root directory.
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=

HUGGINGFACE_API_KEY=your_deepseek_api_key
```

3. Start development server:
```bash
npm run dev
```
Web app can be accesed at http://localhost:3000.

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

1. Build Chrome extension:
```bash
npm run build:extension
```

2. Load extension in Chrome:
   - Go to `chrome://extensions/` on Chrome
   - Enable "Developer mode"
   - Click "Load unpacked" and select `chrome-extension/dist` in project directory
