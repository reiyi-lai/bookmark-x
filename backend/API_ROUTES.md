# 🚀 BookmarkX API Routes - Quick Reference

**Base URL**: `http://localhost:8000`  
**Interactive Docs**: `http://localhost:8000/docs`

---

## 📋 All Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/bookmarks/import` | Import bookmarks from Chrome extension | ❌ |
| `GET` | `/api/bookmarks` | Get user bookmarks + category counts | ✅ |
| `DELETE` | `/api/bookmarks/{id}` | Delete a bookmark | ✅ |
| `PATCH` | `/api/bookmarks/{id}/category` | Update bookmark category | ✅ |
| `POST` | `/api/bookmarks/recategorize` | Recategorize all bookmarks | ✅ |
| `POST` | `/api/users/{user_id}/complete-registration` | Complete user registration | ❌ |
| `GET` | `/api/categories` | Get all categories | ❌ |
| `GET` | `/health` | Health check | ❌ |
| `GET` | `/` | API info | ❌ |

---

## 🔐 Authentication

**Required Header for authenticated endpoints:**
```
x-twitter-id: your_twitter_user_id
```

---

## 🧪 Quick Test Commands

**Health Check:**
```bash
curl http://localhost:8000/health
```

**Get Categories:**
```bash
curl http://localhost:8000/api/categories
```

**Get Bookmarks (with auth):**
```bash
curl -H "x-twitter-id: test_user_123" http://localhost:8000/api/bookmarks
```

**Start Server:**
```bash
cd backend && python main.py
```

---

## 📖 Full Documentation

See `README.md` for complete API documentation with request/response examples, error codes, and integration guides.

---

## 🔍 Interactive Testing

Visit `http://localhost:8000/docs` after starting the server for interactive API testing with Swagger UI! 