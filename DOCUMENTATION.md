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
    - GET /api/bookmarks → Server queries Supabase bookmarks table, returns bookmark array
   - Client-side filtering for categories and search (no server round-trips)
   - Client-side category counting from bookmark data (no server calculation)

## API Routes

### Chrome Extension Routes
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/bookmarks/import` | POST | Bulk import tweets from extension | Twitter ID in payload |

### Web Application Routes
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/bookmarks` | GET | Fetch user bookmarks from Supabase and transform bookmark for client | X-Twitter-ID header |
| `/api/categories` | GET | Fetch categories from Supbase and enrich with metadata | None (public) |
| `/api/bookmarks/:id` | DELETE | Delete specific bookmark | X-Twitter-ID header |
| `/api/bookmarks/:id/category` | PATCH | Update bookmark category | X-Twitter-ID header |
| `/api/users/:userId/complete-registration` | POST | Complete user email registration | X-Twitter-ID header |

### API Response Formats

#### GET `/api/categories`
```typescript
// Response: Category[]
[
  {
    id: 1,
    name: "Content Ideas",
    description: "Ideas for content creation and social media",
    color: "#8b5cf6",
    created_at: "2024-01-01T00:00:00Z",
    icon: "lightbulb",
    order: 1
  },
  // ... other categories
]
```

#### GET `/api/bookmarks`
```typescript
// Response: ClientBookmark[] (client calculates category counts)
[
  {
    id: "1234567890",
    content: "This is an amazing tweet about AI development...",
    url: "https://x.com/user/status/1234567890",
    categoryId: 1,
    tweetId: "1234567890",
    authorName: "John Doe",
    authorUsername: "johndoe",
    authorProfileImage: "https://pbs.twimg.com/profile_images/...",
    createdAt: "2024-01-15T10:30:00Z",
    bookmarkedAt: "2024-01-15T11:00:00Z"
  }
  // ... other bookmarks
]
```

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
