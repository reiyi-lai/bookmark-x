"""
Test script for ML categorizer with detailed debugging
"""
import asyncio
import os
import logging
from services.ml_categorizer import get_categorizer

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_categorizer():
    """Test the ML categorizer with sample tweets"""
    
    # Sample tweets for testing
    test_tweets = [
        "Just deployed my new React app using Next.js and TypeScript! The developer experience is amazing 🚀",
        "Breaking: Apple announces new iPhone with revolutionary AI chip",
        "Amazing goal by Messi in today's match! Barcelona vs Real Madrid was incredible ⚽",
        "New study shows that meditation can reduce stress by 40%. Mental health matters! 🧘‍♀️",
        "Just tried this amazing sushi restaurant in Tokyo. The flavors were incredible! 🍣",
        "We're hiring a Senior Software Engineer at our startup! Remote work, competitive salary, great team. Apply now!"
    ]
    
    print("🤖 Testing ML Categorizer")
    print("=" * 60)
    
    categorizer = get_categorizer()
    
    for i, tweet in enumerate(test_tweets, 1):
        print(f"\n{i}. Tweet: {tweet}")
        print("-" * 50)
        
        try:
            # Test the categorizer and capture any debug info
            category_id = await categorizer.categorize_bookmark(tweet)
            category_description = categorizer.CATEGORY_DESCRIPTIONS.get(category_id, "Unknown Category")
            category_name = category_description.split(" - ")[0]  # Extract just the name part
            print(f"✅ Result: Category {category_id} ({category_name})")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            print(f"📋 Full traceback:")
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("✅ Test completed!")

if __name__ == "__main__":
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("📋 Environment loaded")
    except ImportError:
        print("⚠️  python-dotenv not available, loading env manually")
    
    # Check if OpenAI API key is available
    if os.getenv("OPENAI_API_KEY"):
        print("🔑 OpenAI API key found")
    else:
        print("⚠️  OpenAI API key not found, will use fallback categorization")
    
    # Run the test
    asyncio.run(test_categorizer()) 