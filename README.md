# Bookmark-X - Twitter Bookmark Organizer

Bookmark-X helps you automatically organize your Twitter bookmarks into meaningful categories using ML-powered classification.

## 🚀 Launch Plan (Target: June 6)

### Phase 1: UI & Core Experience (2 days)
- **UI Enhancements (1-1.5 days)**
  - Display tweet author details (name, profile picture, username)
  - Show total bookmark count
  - Expandable tweets with full content + media
  - Interactive loading screen with progress indicators
  
- **Category System (0.5 days)**
  - Refine existing categories
  - Combine overlapping categories
  - Add new categories (startup/product ideas, research papers)

### Phase 2: ML & Backend (2 days)
- Implement sentence-transformers via API
- Optimize 'job opportunities' classification (a more scoped category)
- Enhance categorization accuracy and differentiation

### Phase 3: Chrome Extension (3 days)
- Basic manifest and content script setup
- Twitter bookmark page detection
- One-click categorization
- Auth integration with main app

### Phase 4: User Management (2 days)
- Simple email-based signup flow (don't necessarily need password)
- Database schema updates
- User data persistence
- Basic account management

### Phase 5: Testing & Launch (1 day)
- End-to-end testing
- Performance optimization
- Rate limiting implementation (to manage initial load)
- Launch preparation

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (NeonDB)
- **ML**: TensorFlow.js, Sentence Transformers
- **Auth**: Twitter OAuth

## 🔧 Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Add API keys and configuration
```

3. Start development server:
```bash
npm run dev
```