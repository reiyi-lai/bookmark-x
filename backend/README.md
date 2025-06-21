# BookmarkX FastAPI Backend - API Routes Documentation

A FastAPI backend for managing Twitter bookmarks with AI categorization, fully compatible with Supabase schema.

## 🚀 Quick Start

```bash
cd backend
pip install -r requirements.txt

# Set your environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/bookmarkx"
export OPENAI_API_KEY="your-openai-api-key"  # Optional, for ML categorization

# Run the server
python main.py
```

**API Base URL**: `http://localhost:8000`  
**Interactive Docs**: `http://localhost:8000/docs`  
**ReDoc**: `http://localhost:8000/redoc`

---

## 🤖 AI-Powered Categorization

The backend now includes intelligent bookmark categorization using:
- **OpenAI GPT-4o-mini** with structured output via **bhumi** and **satya**
- **Fallback keyword matching** when OpenAI is unavailable
- **Batch processing** for efficient bulk categorization
- **Smart category mapping** to your existing Supabase categories

### Categories Available:
1. **Content Ideas** - Ideas for creating content
2. **Automation Tools** - Tools for automation
3. **Interesting Reads** - Articles and threads worth reading
4. **Career Tips** - Career advice and tips
5. **Good Quotes** - Motivational and insightful quotes
6. **Knowledge/Trivia** - Interesting facts and trivia
7. **Uncategorized** - Bookmarks that haven't been categorized
10. **Job Opportunities** - Job postings and career opportunities

---

## 📋 API Routes Overview

### 🔖 Bookmarks Routes (`/api/bookmarks`)
- `POST /import` - Import bookmarks from Chrome extension with AI categorization
- `GET /` - Get user bookmarks with category counts
- `DELETE /{id}` - Delete a specific bookmark (UUID)
- `PATCH /{id}/category` - Update bookmark category
- `POST /recategorize` - AI-powered recategorization of all user bookmarks

### 👤 Users Routes (`/api/users`)
- `POST /{user_id}/complete-registration` - Complete user registration with email

### 🏷️ Categories Routes (`/api/categories`)
- `GET /` - Get all available categories

### 🏥 Health & Info
- `GET /health` - Health check endpoint
- `GET /` - API information

---

## 📖 Detailed API Documentation

### 🔖 BOOKMARKS ENDPOINTS

#### 1. Import Bookmarks (AI-Enhanced)
```http
POST /api/bookmarks/import
Content-Type: application/json
```

**What's New**: Automatic AI categorization during import!

**Request Body:**
```json
{
  "bookmarks": [
    {
      "id": "1234567890",
      "url": "https://x.com/username/status/1234567890",
      "text": "This is an amazing new React framework for building fast apps!",
      "author": {
        "username": "username",
        "name": "Display Name",
        "profile_image_url": "https://pbs.twimg.com/profile_images/..."
      },
      "created_at": "2024-01-15T10:30:00Z",
      "media_attachments": [],
      "categoryId": null  // AI will categorize automatically if null
    }
  ],
  "twitterUser": {
    "id": "twitter_user_id_123",
    "username": "my_twitter_handle"
  }
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 10,
    "imported": 8,
    "categorized": {
      "1": 3,  // 3 bookmarks categorized as "Content Ideas"
      "2": 2,  // 2 bookmarks categorized as "Automation Tools"
      "3": 3   // 3 bookmarks categorized as "Interesting Reads"
    }
  },
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Successfully imported bookmarks with AI categorization"
}
```

#### 2. Get User Bookmarks
```http
GET /api/bookmarks
Headers:
  x-twitter-id: your_twitter_id_here
```

**Response:**
```json
{
  "bookmarks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",  // UUID
      "url": "https://x.com/username/status/1234567890",
      "content": "Tweet content here...",
      "categoryId": 1,
      "tweetId": "1234567890",
      "authorName": "Display Name",
      "authorUsername": "username",
      "authorProfileImage": "https://pbs.twimg.com/profile_images/...",
      "createdAt": "2024-01-15T10:30:00Z",
      "bookmarkedAt": "2024-01-15T11:00:00Z",
      "updatedAt": "2024-01-15T11:00:00Z",
      "lastSyncedAt": null
    }
  ],
  "categoryCounts": {
    "1": 15,  // Content Ideas
    "2": 8,   // Automation Tools
    "3": 12   // Interesting Reads
  }
}
```

#### 3. Delete Bookmark
```http
DELETE /api/bookmarks/{bookmark_uuid}
Headers:
  x-twitter-id: your_twitter_id_here
```

#### 4. Update Bookmark Category
```http
PATCH /api/bookmarks/{bookmark_uuid}/category
Headers:
  x-twitter-id: your_twitter_id_here
Content-Type: application/json
```

#### 5. AI-Powered Recategorization
```http
POST /api/bookmarks/recategorize
Headers:
  x-twitter-id: your_twitter_id_here
```

**What it does**: 
- Uses OpenAI GPT-4o-mini to analyze all your bookmarks
- Applies intelligent categorization based on content
- Provides detailed statistics on changes made

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "updated": 35  // 35 bookmarks got better categories
  }
}
```

---

### 👤 USERS ENDPOINTS

#### Complete User Registration
```http
POST /api/users/{user_id}/complete-registration
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

---

### 🏷️ CATEGORIES ENDPOINTS

#### Get All Categories
```http
GET /api/categories
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Content Ideas",
    "description": "Ideas for creating content",
    "color": "#3B82F6",
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "name": "Automation Tools",
    "description": "Tools for automation",
    "color": "#10B981",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

## 🤖 ML Categorization Features

### AI Models Used:
- **Primary**: OpenAI GPT-4o-mini with structured output
- **Fallback**: Keyword-based categorization
- **Framework**: bhumi + satya for reliable structured responses

### How it Works:
1. **Content Analysis**: AI analyzes tweet content, context, and intent
2. **Category Mapping**: Maps to your existing Supabase categories
3. **Confidence Scoring**: Provides confidence levels for predictions
4. **Batch Processing**: Efficiently handles multiple bookmarks
5. **Graceful Fallback**: Uses keyword matching if AI is unavailable

### Example AI Categorization:
```
Input: "Just built an amazing automation script that saves me 2 hours daily!"
Output: Category 2 (Automation Tools) - Confidence: 0.95
Reasoning: "Content discusses building automation tools for productivity"
```

---

## 🗄️ Database Schema (Supabase Compatible)

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_id VARCHAR UNIQUE NOT NULL,
  twitter_username VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  color VARCHAR NOT NULL,  -- Hex color codes
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Bookmarks Table
```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id VARCHAR NOT NULL,
  tweet_url VARCHAR NOT NULL,
  tweet_content TEXT NOT NULL,
  author_username VARCHAR NOT NULL,
  author_display_name VARCHAR NOT NULL,
  author_profile_picture VARCHAR,
  tweet_date TIMESTAMPTZ NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  media_attachments JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);
```

---

## 🛠️ Development Setup

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bookmarkx

# AI Categorization (Optional)
OPENAI_API_KEY=your_openai_api_key_here

# Server
HOST=0.0.0.0
PORT=8000
```

### Key Dependencies
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM
- **Pydantic** - Data validation
- **bhumi** - LLM client abstraction
- **satya** - Structured output validation
- **OpenAI** - AI categorization

### Installation
```bash
pip install -r requirements.txt
```

### Running
```bash
# Development
python main.py

# Production
uvicorn app:app --host 0.0.0.0 --port 8000
```

---

## 🔧 Smart Features

### 1. **Schema Compatibility**
- Fully matches your existing Supabase schema
- No table recreation if they already exist
- UUID-based bookmark IDs

### 2. **AI Categorization**
- Analyzes tweet content intelligently
- Maps to your specific categories
- Handles batch operations efficiently
- Graceful fallback to keyword matching

### 3. **Error Handling**
- Comprehensive error responses
- Validation with Pydantic
- Proper HTTP status codes

### 4. **Performance**
- Bulk database operations
- Efficient ML batch processing
- Connection pooling ready

---

## 🧪 Testing

### Test ML Categorizer:
```bash
python test_ml_categorizer.py
```

### Test API Import:
```bash
curl -X POST "http://localhost:8000/docs" # Use interactive docs
```

---

## 🚀 Production Ready

✅ **Supabase Compatible**  
✅ **AI-Powered Categorization**  
✅ **Type-Safe with Pydantic**  
✅ **Efficient Bulk Operations**  
✅ **Comprehensive Error Handling**  
✅ **Auto-Generated Documentation**  
✅ **Graceful AI Fallbacks**  

Your FastAPI backend is now ready to handle intelligent bookmark categorization with seamless Supabase integration! 🎉 