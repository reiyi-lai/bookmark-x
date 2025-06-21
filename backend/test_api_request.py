#!/usr/bin/env python3
"""
Test script for ML categorization API on deployed server
"""
import requests
import json
import sys

# API Configuration
API_BASE_URL = "https://bookmark.smol.ly"
# API_BASE_URL = "http://localhost:8000"  # Uncomment for local testing

def test_recategorize_endpoint():
    """Test the recategorize endpoint"""
    
    # You'll need to replace this with a real Twitter ID
    twitter_id = "1800531627216629760"  # Replace with actual Twitter ID
    
    url = f"{API_BASE_URL}/api/bookmarks/recategorize"
    
    headers = {
        "x-twitter-id": twitter_id,
        "Content-Type": "application/json"
    }
    
    print(f"🚀 Testing ML Categorization API")
    print(f"📍 URL: {url}")
    print(f"🔑 Twitter ID: {twitter_id}")
    print("-" * 60)
    
    try:
        print("📤 Sending POST request...")
        response = requests.post(url, headers=headers, timeout=360)  # 6 minute timeout for ML processing
        
        print(f"📥 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        # Print response body
        try:
            response_json = response.json()
            print(f"📄 Response Body:")
            print(json.dumps(response_json, indent=2))
            
            # Check if successful
            if response.status_code == 200:
                if response_json.get("success"):
                    stats = response_json.get("stats", {})
                    total = stats.get("total", 0)
                    updated = stats.get("updated", 0)
                    print(f"\n✅ Success! Updated {updated} of {total} bookmarks")
                else:
                    print(f"\n❌ Request failed: {response_json}")
            else:
                print(f"\n❌ HTTP Error {response.status_code}")
                
        except json.JSONDecodeError:
            print(f"📄 Raw Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    
    return True

def test_import_endpoint():
    """Test the import endpoint with sample data"""
    
    twitter_id = "123456789"  # Replace with actual Twitter ID
    
    url = f"{API_BASE_URL}/api/bookmarks/import"
    
    headers = {
        "x-twitter-id": twitter_id,
        "Content-Type": "application/json"
    }
    
    # Sample bookmark data
    sample_bookmarks = [
        {
            "id": "1234567890",
            "url": "https://twitter.com/user/status/1234567890",
            "text": "Just deployed my new React app using Next.js and TypeScript! The developer experience is amazing 🚀",
            "author": {
                "username": "developer123",
                "name": "John Developer",
                "profile_image_url": "https://pbs.twimg.com/profile_images/example.jpg"
            },
            "created_at": "2024-01-15T10:30:00Z",
            "categoryId": None,
            "media_attachments": []
        },
        {
            "id": "1234567891",
            "url": "https://twitter.com/user/status/1234567891",
            "text": "Amazing goal by Messi in today's match! Barcelona vs Real Madrid was incredible ⚽",
            "author": {
                "username": "soccerfan",
                "name": "Soccer Fan",
                "profile_image_url": "https://pbs.twimg.com/profile_images/example2.jpg"
            },
            "created_at": "2024-01-15T11:00:00Z",
            "categoryId": None,
            "media_attachments": []
        }
    ]
    
    payload = {
        "bookmarks": sample_bookmarks,
        "userId": twitter_id,
        "twitterUser": {
            "id": twitter_id,
            "username": "testuser123",
            "name": "Test User",
            "profile_image_url": "https://pbs.twimg.com/profile_images/example_user.jpg"
        }
    }
    
    print(f"\n🚀 Testing Import API with ML Categorization")
    print(f"📍 URL: {url}")
    print(f"🔑 Twitter ID: {twitter_id}")
    print(f"📦 Bookmarks: {len(sample_bookmarks)}")
    print("-" * 60)
    
    try:
        print("📤 Sending POST request...")
        response = requests.post(url, headers=headers, json=payload, timeout=360)  # 6 minute timeout for ML processing
        
        print(f"📥 Response Status: {response.status_code}")
        
        try:
            response_json = response.json()
            print(f"📄 Response Body:")
            print(json.dumps(response_json, indent=2))
            
            if response.status_code == 200:
                if response_json.get("success"):
                    stats = response_json.get("stats", {})
                    total = stats.get("total", 0)
                    imported = stats.get("imported", 0)
                    categorized = stats.get("categorized", {})
                    
                    print(f"\n✅ Success! Imported {imported} of {total} bookmarks")
                    print(f"📊 Categorization breakdown:")
                    for category_id, count in categorized.items():
                        print(f"   Category {category_id}: {count} bookmarks")
                else:
                    print(f"\n❌ Request failed: {response_json}")
            else:
                print(f"\n❌ HTTP Error {response.status_code}")
                
        except json.JSONDecodeError:
            print(f"📄 Raw Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    
    return True

def test_health_check():
    """Test if the API is accessible"""
    
    url = f"{API_BASE_URL}/health"
    
    print(f"🏥 Testing API Health Check")
    print(f"📍 URL: {url}")
    print("-" * 60)
    
    try:
        response = requests.get(url, timeout=10)
        print(f"📥 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                response_json = response.json()
                print(f"📄 Response: {json.dumps(response_json, indent=2)}")
                print("✅ API is healthy!")
            except json.JSONDecodeError:
                print(f"📄 Raw Response: {response.text}")
                print("✅ API is responding!")
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False
    
    return True

def main():
    """Run all tests"""
    
    if len(sys.argv) > 1:
        twitter_id = sys.argv[1]
        print(f"🔑 Using provided Twitter ID: {twitter_id}")
    else:
        print("⚠️  No Twitter ID provided. Using default test ID.")
        print("💡 Usage: python test_api_request.py <twitter_id>")
    
    print("🧪 Testing Bookmark ML Categorization API")
    print("=" * 60)
    
    # Test 1: Health check
    health_ok = test_health_check()
    
    if not health_ok:
        print("\n❌ API health check failed. Skipping other tests.")
        return
    
    # Test 2: Recategorize endpoint
    print("\n" + "=" * 60)
    recategorize_ok = test_recategorize_endpoint()
    
    # Test 3: Import endpoint
    print("\n" + "=" * 60)
    import_ok = test_import_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary:")
    print(f"   Health Check: {'✅' if health_ok else '❌'}")
    print(f"   Recategorize: {'✅' if recategorize_ok else '❌'}")
    print(f"   Import: {'✅' if import_ok else '❌'}")
    
    if all([health_ok, recategorize_ok, import_ok]):
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed. Check the output above.")

if __name__ == "__main__":
    main() 