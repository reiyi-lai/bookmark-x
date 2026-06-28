## Data Flow

1. **Tweet Collection (Chrome Extension)**
   ```
   Raw Tweets → CollectedTweet → ImportedBookmark
   ```
   - User visits Twitter bookmarks page
   - Injection script extracts tweet via sending GET request directly to x.com's GraphQL API with updated 'cursor'
   - Background script processes and sends to server

2. **Server Processing**
   ```
   ImportedBookmark → OpenAI API  → Supabase Storage
   ```
   - Server receives bulk tweet data
   - OpenAI reads tweets and assigns categories
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

#### Chrome Extension Routes
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/bookmarks/import` | POST | Bulk import tweets from extension + gets categorized tweets from bookmark service and bulk upserts into Supabase | Twitter ID in payload |

#### Web Application Routes
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/bookmarks` | GET | Fetch user bookmarks from Supabase and transform bookmark for client | X-Twitter-ID header |
| `/api/categories` | GET | Fetch categories from Supabase and enrich with metadata | None (public) |
| `/api/bookmarks/:id` | DELETE | Delete specific bookmark | X-Twitter-ID header |
| `/api/bookmarks/:id/category` | PATCH | Update bookmark category | X-Twitter-ID header |
| `/api/users/:userId/complete-registration` | POST | Complete user email registration | X-Twitter-ID header |

### Authentication Flow

#### Chrome Extension → Server
```
Extension Collection → Twitter User Info → Server Validation → User Creation/Lookup
```
- Extension extracts Twitter user info via GraphQL API request
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
// Raw data from GraphQL extraction
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

### 2. ImportedBookmark → ProcessedBookmark (ML Categorization)
**Location:** `server/services/bookmark-service.ts:processBookmarks()`

**Input Format:**
```typescript
// Input parameter
bookmarksData: ImportedBookmark[]

// ImportedBookmark interface
interface ImportedBookmark {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  media_attachments?: MediaAttachment[] | null;
  url: string;
  author: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string | null;
  };
}
```

**Output Format:**
```typescript
// Return type
Promise<{
  bookmarks: ProcessedBookmark[];
  categories: Category[];
}>

// ProcessedBookmark interface
interface ProcessedBookmark extends ImportedBookmark {
  categoryId: number; // Added by ML categorizer
}

// Category interface
interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  icon: string;        // Added by metadata enrichment
  order: number;       // Added by metadata enrichment
}
```

### 3. DatabaseBookmark → ClientBookmark
**Location:** `server/routes/index.ts:/api/bookmarks`
```typescript
// Database schema (simplified)
interface DatabaseBookmark {
  id: string;
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

### Detailed API Specifications

#### Chrome Extension Routes

##### POST `/api/bookmarks/import`
**Purpose:** Bulk import tweets from extension + gets categorized tweets from bookmark service and bulk inserts into Supabase  
**Authentication:** Twitter ID in payload

**Request:**
```typescript
{
  "bookmarks": ImportedBookmark[],
  "twitterUser": {
    "id": string,
    "username"?: string
  }
}

// ImportedBookmark interface:
interface ImportedBookmark {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  media_attachments?: MediaAttachment[] | null;
  url: string;
  author: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string | null;
  };
}
```

**Server Processing:**
1. **Validation**: Validate request body contains bookmarks array and twitterUser.id
2. **User Management**: 
   - Query Supabase `users` table for existing user by `twitter_id`
   - If not found, create new user with `twitter_id` and optional `twitter_username`
   - Store `userId` for subsequent operations
3. **ML Categorization**: 
   - Call `BookmarkService.processBookmarks()` which:
     - Fetches categories from Supabase `categories` table
     - Initializes ML categorizer with categories
     - Batch categorizes all bookmark texts using ML service
     - Returns processed bookmarks with assigned `categoryId` (see `## Data Transformations 2.`)
4. **Duplicate Detection**:
   - Query Supabase `bookmarks` table for existing `tweet_id` values for this user
   - Filter out duplicates from the import batch
5. **Batch Database Insert**:
   - Transform `ImportedBookmark` objects to database schema format
   - Insert in chunks of 500 bookmarks to Supabase `bookmarks` table
   - Add 100ms delay between chunks to respect rate limits
6. **Statistics Calculation**:
   - Count total processed, imported, and categorized bookmarks
   - Generate category distribution statistics

**Response:**
```typescript
{
  "success": boolean,
  "stats": {
    "total": number,
    "imported": number,
    "categorized": Record<number, number>
  },
  "userId": string,
  "message"?: string
}
```

**Error Response:**
```typescript
{
  "error": string
}
```

---

#### Web Application Routes

##### GET `/api/bookmarks`
**Purpose:** Fetch user bookmarks from Supabase and transform bookmark for client  
**Authentication:** X-Twitter-ID header

**Request:**
```typescript
// Headers
{
  "X-Twitter-ID": string
}
```

**Server Processing:**
1. **Authentication**: 
   - Extract `X-Twitter-ID` from request headers
   - Query Supabase `users` table to get `userId` by `twitter_id`
   - Return 401 if user not found
2. **Database Query**:
   - Query Supabase `bookmarks` table with `user_id` filter
   - Select specific fields: `id`, `tweet_id`, `tweet_url`, `tweet_content`, `category_id`, `author_username`, `author_display_name`, `author_profile_picture`, `tweet_date`, `created_at`
3. **Data Transformation**:
   - Transform database schema to client-friendly format
   - Convert `tweet_date` and `created_at` to Date objects
   - Map field names (e.g., `tweet_content` → `content`, `author_display_name` → `authorName`)

**Response:**
```typescript
// ClientBookmark[]
[
  {
    "id": string,
    "content": string,
    "url": string,
    "categoryId": number,
    "tweetId": string,
    "authorName": string,
    "authorUsername": string,
    "authorProfileImage": string | null,
    "createdAt": Date,
    "bookmarkedAt": Date
  }
  // ... other bookmarks
]
```

---

##### GET `/api/categories`
**Purpose:** Fetch categories from Supabase and enrich with metadata  
**Authentication:** None (public)

**Request:**
```typescript
// No body or headers required
```

**Server Processing:**
1. **Database Query**:
   - Query Supabase `categories` table to fetch all categories
   - Select all fields: `id`, `name`, `description`, `color`, `created_at`
2. **Metadata Enrichment**:
   - Call `enrichCategoryWithMetadata()` for each category
   - Add UI metadata from `CATEGORY_METADATA` constant:
     - `icon`: Material Icons identifier for category
     - `order`: Display order for sorting
3. **Sorting**:
   - Sort categories by `order` field (ascending)
   - Ensures consistent display order in client

**Response:**
```typescript
// Category[]
[
  {
    "id": number,
    "name": string,
    "description": string,
    "color": string,
    "created_at": string,
    "icon": string,
    "order": number
  }
  // ... other categories
]
```

---

##### DELETE `/api/bookmarks/:id`
**Purpose:** Delete specific bookmark  
**Authentication:** X-Twitter-ID header

**Request:**
```typescript
// Headers
{
  "X-Twitter-ID": string
}

// URL Parameters
{
  "id": number // bookmark ID
}
```

**Server Processing:**
1. **Parameter Validation**:
   - Parse bookmark ID from URL parameter
   - Validate it's a valid integer, return 400 if not
2. **Authentication**:
   - Extract `X-Twitter-ID` from request headers
   - Query Supabase `users` table to get `userId` by `twitter_id`
   - Return 401 if user not found
3. **Database Delete**:
   - Delete from Supabase `bookmarks` table where:
     - `id` = bookmark ID (ensures correct bookmark)
     - `user_id` = authenticated user ID (ensures ownership)
   - Double-filter prevents users from deleting other users' bookmarks

**Response:**
```typescript
{
  "success": boolean
}
```

**Error Response:**
```typescript
{
  "error": string
}
```

---

##### PATCH `/api/bookmarks/:id/category`
**Purpose:** Update bookmark category  
**Authentication:** X-Twitter-ID header

**Request:**
```typescript
// Headers
{
  "X-Twitter-ID": string
}

// URL Parameters
{
  "id": number // bookmark ID
}

// Body
{
  "categoryId": number
}
```

**Server Processing:**
1. **Parameter Validation**:
   - Parse bookmark ID from URL parameter
   - Validate it's a valid integer, return 400 if not
   - Validate `categoryId` exists in request body
2. **Authentication**:
   - Extract `X-Twitter-ID` from request headers
   - Query Supabase `users` table to get `userId` by `twitter_id`
   - Return 401 if user not found
3. **Database Update**:
   - Update Supabase `bookmarks` table:
     - Set `category_id` = new categoryId
     - Where `id` = bookmark ID AND `user_id` = authenticated user ID
   - Double-filter ensures user can only update their own bookmarks

**Response:**
```typescript
{
  "success": boolean
}
```

**Error Response:**
```typescript
{
  "error": string
}
```

---

##### POST `/api/users/:userId/complete-registration`
**Purpose:** Complete user email registration  
**Authentication:** X-Twitter-ID header

**Request:**
```typescript
// Headers
{
  "X-Twitter-ID": string
}

// URL Parameters
{
  "userId": string
}

// Body
{
  "email": string
}
```

**Server Processing:**
1. **Input Validation**:
   - Validate `email` exists in request body
   - Extract `userId` from URL parameters
2. **Security Check**:
   - Extract `X-Twitter-ID` from request headers
   - Query Supabase `users` table to get authenticated user's ID
   - Verify requesting user owns the `userId` being modified (prevents unauthorized updates)
   - Return 403 if user IDs don't match
3. **User Verification**:
   - Query Supabase `users` table to verify user exists and get current email status
   - Return 404 if user not found
   - Return 400 if user already has email registered
4. **Email Uniqueness Check**:
   - Query Supabase `users` table to check if email already exists for another user
   - Return 409 with specific error format if email already taken
5. **Database Update**:
   - Update Supabase `users` table:
     - Set `email` = provided email
     - Where `id` = userId

**Response:**
```typescript
{
  "success": boolean,
  "message": string
}
```

**Error Responses:**
```typescript
// Email already exists
{
  "error": "EMAIL_ALREADY_EXISTS",
  "title": "Enter another email",
  "message": "Email already exists under another x.com account"
}

// Other errors
{
  "error": string
}
```