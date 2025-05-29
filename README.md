# Bookmark-X - Twitter Bookmark Organizer

Bookmark-X helps you automatically organize your Twitter bookmarks into meaningful categories using ML-powered classification.

## 🚀 Soft Launch Plan (Target: June 6)

### UI Changes (2 days)
- **UI Enhancements (1-1.5 days)**
  - Show total bookmark count
  - Display tweet author details (name, profile picture, username)
  - Expandable tweets with full content + media
  - Interactive loading screen with progress indicators
  
- **Category System (0.5 days)**
  - Refine existing categories
  - Combine overlapping categories
  - Add new categories (startup/product ideas, research papers)

### ML Enhancements (2 days)
- Implement sentence-transformers
- Optimize 'job opportunities' classification (a more scoped category)
- Enhance categorization accuracy and differentiation

### Chrome Extension Build (3 days)
- Basic manifest and content script setup
- Twitter bookmark page detection
- One-click categorization
- Auth integration with main app

### User Management (2 days)
- Simple email-based signup flow (don't necessarily need password)
- Database setup (Supabase?)
- User data persistence
- Basic account management

### Testing & Launch (1 day)
- End-to-end testing
- Performance optimization
- Rate limiting implementation (to manage initial load)
- Launch preparation

### Post June-6 (1 week)
- Think hard about distribution strategy

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (NeonDB)
- **ML**: DeepSeek, Embedding-based Similarity, TF-IDF + Keyword Matching (potentially)

## 🔧 Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in .env.

3. Start development server:
```bash
npm run dev
```
