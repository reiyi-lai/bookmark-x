# SavedIn — LinkedIn Saved Posts Categorizer

## Overview

A Chrome extension + web dashboard that automatically collects and categorizes LinkedIn saved posts using Claude Haiku. Adapted from BookmarkBuddy (Twitter/X bookmarks) with significant architectural improvements.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3, TypeScript, Vite |
| Frontend | React, TailwindCSS, Radix UI, React Query, Wouter — deployed on **Vercel** |
| Backend | **Cloudflare Workers** (Hono framework) — replaces Express/Railway |
| Database | **Supabase** (PostgreSQL + Auth + RLS) |
| Categorization | **Claude Haiku** via Anthropic API |

---

## Architecture Changes from BookmarkBuddy

| Area | BookmarkBuddy | SavedIn |
|------|--------------|---------|
| Collection | Network interception + DOM scraping (2 paths) | Network interception + auto-scroll (single unified path) |
| Categorization | TF-IDF + local LLM chain (845 lines) | Claude Haiku API (~50 lines) |
| Auth | Trust Twitter ID from extension (no real auth) | Supabase Auth (Google OAuth + Magic Link) |
| Backend | Express on Railway | Cloudflare Workers (Hono) |
| Filtering | All client-side | Server-side with cursor pagination |
| Categories | Hardcoded 8 categories | 4 defaults + LLM-suggested extras, user-editable |
| Sync | Full re-import every time | Incremental sync with cursor tracking |

---

## 1. Chrome Extension

### 1.1 Collection Mechanism

**How it works:**
1. On install/click, extension opens `linkedin.com/my-items/saved-posts/`
2. Background service worker uses `webRequest` to passively capture LinkedIn API response headers/cookies
3. Content script auto-scrolls the saved posts page (with human-like randomized delays to reduce detection risk)
4. As LinkedIn lazily loads posts, the extension intercepts the network responses containing post data
5. Posts are deduplicated by post ID in a `Map`
6. Extension popup shows a **live counter** ("X posts captured…") updating in real-time
7. When scrolling reaches the end (no new posts), collection completes automatically
8. User clicks "Categorize & Save" to send posts to the backend

**Key files:**
- `chrome-extension/src/background.ts` — Service worker, webRequest listener, message routing
- `chrome-extension/src/content.ts` — Auto-scroll logic, post count messaging
- `chrome-extension/src/popup/` — Live counter UI, sync controls

**Anti-detection measures:**
- Randomized scroll intervals (2-4s between scrolls)
- Human-like scroll distances (varied pixel amounts)
- No direct API calls with captured credentials — only observe responses
- Respect LinkedIn's rate patterns

### 1.2 Data Shape (captured from LinkedIn)

```typescript
interface LinkedInSavedPost {
  postId: string;
  postUrl: string;
  content: string;           // Post text
  authorName: string;
  authorHeadline: string;    // LinkedIn headline (e.g. "CEO at Company")
  authorProfileUrl: string;
  authorProfilePicture: string;
  savedAt: string;           // When user saved it
  postedAt: string;          // When it was originally posted
  reactions: number;
  comments: number;
  reposts: number;
  mediaAttachments: { type: string; url: string }[];
}
```

### 1.3 Extension Popup

- "Start Sync" button — opens saved posts page and begins auto-scroll collection
- Live counter: "42 posts captured…"
- "Categorize & Save" button — sends to backend
- Status indicator (syncing / done / error)
- Link to open the SavedIn web dashboard

---

## 2. Backend (Cloudflare Workers + Hono)

### 2.1 API Endpoints

```
POST   /api/posts/import          — Bulk import + categorize posts
GET    /api/posts                  — Paginated posts (cursor-based), filterable by category/search
GET    /api/categories             — User's categories
POST   /api/categories             — Create custom category
PATCH  /api/categories/:id         — Rename/update category
DELETE /api/categories/:id         — Delete category (moves posts to Uncategorized)
PATCH  /api/posts/:id/category     — Recategorize a post
DELETE /api/posts/:id              — Delete a post
```

**Auth:** All endpoints (except health check) require a valid Supabase JWT in the `Authorization` header. The worker validates the JWT and extracts `user_id`.

### 2.2 Categorization Flow (POST /api/posts/import)

```
1. Validate JWT → extract user_id
2. Fetch user's categories from DB
3. Filter out posts already in DB (by postId, incremental sync)
4. Batch new posts in groups of 20
5. For each batch, call Claude Haiku:
   - System prompt includes category names + descriptions
   - User prompt includes post texts
   - Response: JSON mapping postId → categoryName
6. SPECIAL: On first import, include a meta-prompt asking Haiku:
   "Based on these posts, suggest 1-2 additional categories
    that are NOT covered by the existing categories:
    [Job Opportunities/Postings, Influencer Posts, Industry News/Writings, Job Announcements].
    Only suggest if there's a clear cluster of 3+ posts that fit."
7. If Haiku suggests new categories → create them in DB, assign relevant posts
8. Batch insert posts into DB with category assignments
9. Return import stats + any newly created categories
```

### 2.3 Cloudflare Worker Structure

```
worker/
├── src/
│   ├── index.ts              — Hono app entry, middleware
│   ├── routes/
│   │   ├── posts.ts          — Post CRUD endpoints
│   │   └── categories.ts     — Category CRUD endpoints
│   ├── services/
│   │   ├── categorizer.ts    — Claude Haiku categorization logic
│   │   └── post-service.ts   — Business logic
│   ├── middleware/
│   │   └── auth.ts           — Supabase JWT validation
│   └── lib/
│       └── supabase.ts       — Supabase client init
├── wrangler.toml             — Cloudflare config
└── package.json
```

---

## 3. Database (Supabase)

### 3.1 Schema

```sql
-- Users table (managed by Supabase Auth, extended with profile)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories (per-user, with defaults seeded on first import)
CREATE TABLE public.categories (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,              -- Hex color for UI
  is_default BOOLEAN DEFAULT false,  -- True for the 4 preset categories
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Saved posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id VARCHAR NOT NULL,          -- LinkedIn post ID
  post_url TEXT,
  content TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  author_name VARCHAR,
  author_headline TEXT,
  author_profile_url TEXT,
  author_profile_picture TEXT,
  reactions INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  media_attachments JSONB DEFAULT '[]',
  posted_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Sync state
CREATE TABLE public.sync_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_synced_at TIMESTAMPTZ,
  last_post_cursor TEXT,     -- For incremental sync
  total_posts_synced INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_category_id ON posts(category_id);
CREATE INDEX idx_posts_post_id ON posts(post_id);
CREATE INDEX idx_posts_content_search ON posts USING gin(to_tsvector('english', content));
CREATE INDEX idx_categories_user_id ON categories(user_id);
```

### 3.2 Row-Level Security

```sql
-- Users can only access their own data
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_posts" ON posts
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_categories" ON categories
  FOR ALL USING (auth.uid() = user_id);
```

### 3.3 Default Categories (seeded per user on first import)

| Name | Description | Color |
|------|------------|-------|
| Job Opportunities/Postings | Active job listings and hiring posts | #3B82F6 |
| Influencer Posts | Thought leadership and viral content from influencers | #8B5CF6 |
| Industry News/Writings | News articles, reports, and industry analysis | #10B981 |
| Job Announcements | People announcing new roles, promotions, milestones | #F59E0B |
| Uncategorized | Posts that don't fit other categories | #6B7280 |

Plus 1-2 LLM-suggested categories after first import analysis.

---

## 4. Frontend (React + Vercel)

### 4.1 Pages

- `/` — Landing page (public)
- `/login` — Auth page (Google OAuth + Magic Link via Supabase Auth UI)
- `/app` — Main dashboard (protected)
- `/privacy-policy` — Privacy policy

### 4.2 Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  SavedIn                    Search...   [Sync]   │
├──────────┬──────────────────────────────────────┤
│ All (84) │  Post Card  │  Post Card  │  Post    │
│          │  ─────────  │  ─────────  │  Card    │
│ Job      │  Author     │  Author     │          │
│ Opps (12)│  Content... │  Content... │          │
│          │  [Category] │  [Category] │          │
│ Influ-   │             │             │          │
│ encer(23)│  Post Card  │  Post Card  │          │
│          │  ─────────  │  ─────────  │          │
│ Indus-   │             │             │          │
│ try  (30)│             │             │          │
│          │             │             │          │
│ Job      │             │             │          │
│ Ann. (11)│             │             │          │
│          │             │             │          │
│ + Add    │             │             │          │
│ Category │             │             │          │
└──────────┴──────────────────────────────────────┘
```

### 4.3 Key Differences from BookmarkBuddy Client

- **Server-side pagination** — GET `/api/posts?cursor=X&limit=20&category=Y&search=Z`
- **Category management UI** — Add/rename/delete categories in sidebar
- **Supabase Auth integration** — Real login flow, session management
- **Post cards show LinkedIn-specific data** — Author headline, reactions/comments/reposts counts

### 4.4 Client Structure

```
client/
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── landing.tsx
│   │   ├── login.tsx
│   │   ├── dashboard.tsx
│   │   └── privacy.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainContent.tsx
│   │   ├── posts/
│   │   │   ├── PostCard.tsx
│   │   │   └── PostsGrid.tsx
│   │   ├── categories/
│   │   │   ├── CategoryList.tsx
│   │   │   └── CategoryEditor.tsx
│   │   └── ui/ (Radix components)
│   ├── hooks/
│   │   ├── usePosts.ts
│   │   ├── useCategories.ts
│   │   └── useAuth.ts
│   ├── contexts/
│   │   └── ThemeContext.tsx
│   └── lib/
│       ├── supabase.ts
│       ├── api.ts
│       └── queryClient.ts
└── package.json
```

---

## 5. Shared Types

```typescript
// shared/types.ts
export interface SavedPost {
  id: string;
  postId: string;
  postUrl: string;
  content: string;
  categoryId: number | null;
  categoryName?: string;
  authorName: string;
  authorHeadline: string;
  authorProfileUrl: string;
  authorProfilePicture: string;
  reactions: number;
  comments: number;
  reposts: number;
  mediaAttachments: { type: string; url: string }[];
  postedAt: Date;
  savedAt: Date;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  isDefault: boolean;
  displayOrder: number;
  postCount?: number;  // computed
}

export interface ImportPayload {
  posts: LinkedInSavedPost[];
  syncCursor?: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicatesSkipped: number;
  categorized: Record<string, number>;
  suggestedCategories?: { name: string; description: string; postIds: string[] }[];
}
```

---

## 6. Project Structure (Monorepo)

```
savedin/
├── chrome-extension/        # Chrome extension
│   ├── src/
│   ├── manifest.json
│   ├── vite.config.ts
│   └── package.json
├── client/                  # React frontend (Vercel)
│   ├── src/
│   ├── vite.config.ts
│   └── package.json
├── worker/                  # Cloudflare Worker backend
│   ├── src/
│   ├── wrangler.toml
│   └── package.json
├── shared/                  # Shared types
│   ├── types.ts
│   └── package.json
├── supabase/                # DB migrations
│   └── migrations/
├── package.json             # Root workspace
└── Plan.md                  # This file
```

---

## 7. Implementation Order

### Phase 1: Foundation
1. Initialize monorepo with workspace config
2. Set up Supabase project — run migrations, configure Auth (Google OAuth + Magic Link)
3. Scaffold Cloudflare Worker with Hono — health check, auth middleware, Supabase client
4. Scaffold React client with Vite — routing, Supabase Auth UI, protected routes

### Phase 2: Backend API
5. Implement category CRUD endpoints
6. Implement post CRUD + pagination endpoints
7. Implement Claude Haiku categorization service
8. Implement `POST /api/posts/import` with categorization + category suggestion logic

### Phase 3: Chrome Extension
9. Manifest V3 setup with LinkedIn permissions
10. Background service worker — webRequest listener for LinkedIn API responses
11. Content script — auto-scroll with anti-detection delays
12. Popup UI — live counter, sync controls, dashboard link

### Phase 4: Frontend Dashboard
13. Landing page + auth flow (Google OAuth + Magic Link)
14. Dashboard layout — sidebar with categories, main content grid
15. Post cards with LinkedIn-specific metadata
16. Category management UI (add/rename/delete)
17. Search + paginated browsing
18. Sync trigger from dashboard

### Phase 5: Polish
19. Dark/light theme
20. Mobile responsive layout
21. Error handling and loading states
22. Extension <-> dashboard redirect flow after sync

---

## 8. Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=          # Client-side
SUPABASE_SERVICE_ROLE_KEY=  # Worker-side

# Anthropic
ANTHROPIC_API_KEY=

# Cloudflare (in wrangler.toml secrets)
# SUPABASE_SERVICE_ROLE_KEY
# ANTHROPIC_API_KEY
```

---

## 9. Verification / Testing Plan

1. **Extension collection:** Install unpacked extension, navigate to LinkedIn saved posts, verify posts are captured via network interception + auto-scroll, check live counter updates
2. **Import + categorization:** Send test batch to `POST /api/posts/import`, verify posts appear in DB with correct categories, verify LLM suggests additional categories when applicable
3. **Dashboard:** Log in via Google OAuth, verify categories and posts load, test pagination, search, and category filtering
4. **Category management:** Create/rename/delete categories, verify posts reassign correctly
5. **Incremental sync:** Run sync twice, verify second run only imports new posts
6. **Auth security:** Verify RLS prevents cross-user data access, verify unauthenticated requests are rejected
