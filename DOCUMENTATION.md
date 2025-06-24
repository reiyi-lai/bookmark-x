## Data Flow

1. **Tweet Collection (Chrome Extension)**
   ```
   Raw Tweets → CollectedTweet → ImportedBookmark
   ```
   - User visits Twitter bookmarks page
   - Content script scrapes tweet data via DOM manipulation
   - Background script processes and sends to server

2. **Server Processing**
   ```
   ImportedBookmark → ML Categorizer → Supabase Storage
   ```
   - Server receives bulk tweet data
   - ML categorizer assigns categories using hybrid approach (TF-IDF + DeepSeek API)
   - Processed bookmarks stored in Supabase
   - Data transformed for client consumption

3. **Client Display**
   ```
   Client Request → Server → Supabase Query → Data Transform → Client Display
   ```
   - Client fires TWO requests and gets responses for:
    - GET /api/categories → Server queries Supabase categories table
    - GET /api/bookmarks (bookmarks and category counts) → Server queries Supabase bookmarks table
   - Client-side filtering for categories and search (no server round-trips)

## Data Transformations

### 1. CollectedTweet → ImportedBookmark
**Location:** `chrome-extension/src/background.ts:processRawTweetData()`
```typescript
// Raw data from DOM scraping
interface CollectedTweet {
  tweetId: string;
  tweetUrl: string;
  authorName: string;
  handle: string;
  tweetText: string;
  time: string;
  profilePicture: string;
  media: 'has_media' | null;
}

// Standardized format for server
interface ImportedBookmark {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  media_attachments?: MediaAttachment[] | null;
  url: string;
  author: { id, name, username, profile_image_url };
}
```

### 2. ImportedBookmark → Database Storage
**Location:** `server/routes/index.ts:/api/bookmarks/import`
- Validates user authentication
- Processes through ML categorizer
- Stores in Supabase `bookmarks` table

### 3. Database → ClientBookmark
**Location:** `server/routes/index.ts:/api/bookmarks`
```typescript
// Database schema (simplified)
interface DatabaseBookmark {
  id: number;
  tweet_id: string;
  tweet_content: string;
  category_id: number;
  author_username: string;
  // ... other fields
}

// Client-optimized format
interface ClientBookmark {
  id: string;
  content: string;
  categoryId: number;
  authorName: string;
  createdAt: Date;
  // ... other fields
}
```

## API Routes

### Chrome Extension Routes
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/bookmarks/import` | POST | Bulk import tweets from extension | Twitter ID in payload |

### Web Application Routes
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/bookmarks` | GET | Fetch user bookmarks with count from Supabase | X-Twitter-ID header |
| `/api/bookmarks/:id` | DELETE | Delete specific bookmark | X-Twitter-ID header |
| `/api/bookmarks/:id/category` | PATCH | Update bookmark category | X-Twitter-ID header |
| `/api/categories` | GET | Fetch all categories with metadata | None (public) |
| `/api/users/:userId/complete-registration` | POST | Complete user email registration | X-Twitter-ID header |

### Authentication Flow

#### Chrome Extension → Server
```
Extension Collection → Twitter User Info → Server Validation → User Creation/Lookup
```
- Extension extracts Twitter user info from DOM
- Sends user data with bookmark payload
- Server creates or finds existing user in Supabase

#### Client → Server
```
Client Request → Twitter ID in Header → User Lookup → Request Processing
```
- Client includes `X-Twitter-ID` header
- Server validates user exists in database
- Processes request with user context

