"""
ML-powered bookmark categorization service using bhumi and satya
"""
import asyncio
import os
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import re

try:
    from bhumi.base_client import BaseLLMClient, LLMConfig
    from satya import Model, Field
    from satya.openai import OpenAISchema
    BHUMI_AVAILABLE = True
except ImportError:
    BHUMI_AVAILABLE = False
    # Fallback for when bhumi/satya are not available
    class Model:
        pass
    def Field(*args, **kwargs):
        return None

logger = logging.getLogger(__name__)

class CategoryPrediction(Model):
    """AI prediction for bookmark category"""
    category_id: int = Field(description="Predicted category ID")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score for the prediction")
    reasoning: str = Field(min_length=10, description="Brief explanation for the categorization")

class BookmarkCategorization(Model):
    """Complete categorization result for a bookmark"""
    tweet_content: str = Field(description="The original tweet content")
    prediction: CategoryPrediction = Field(description="AI categorization prediction")
    categories_considered: List[int] = Field(description="List of category IDs that were considered")

class MLCategorizer:
    """AI-powered bookmark categorizer using OpenAI and structured output"""
    
    # Valid category IDs from your database
    VALID_CATEGORIES = {1, 2, 3, 4, 5, 6, 7, 10}
    
    # Category mapping for better AI understanding
    CATEGORY_DESCRIPTIONS = {
        1: "Content Ideas - Ideas for creating content",
        2: "Automation Tools - Tools for automation",  
        3: "Interesting Reads - Articles and threads worth reading",
        4: "Career Tips - Career advice and tips",
        5: "Good Quotes - Motivational and insightful quotes",
        6: "Knowledge/Trivia - Interesting facts and trivia",
        7: "Uncategorized - Bookmarks that haven't been categorized",
        10: "Job Opportunities - Job postings, hiring announcements, and career opportunities"
    }

    def __init__(self):
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the AI client if bhumi is available"""
        if not BHUMI_AVAILABLE:
            logger.warning("Bhumi/Satya not available. Using fallback categorization.")
            return
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not found. Using fallback categorization.")
            return
        
        try:
            config = LLMConfig(
                api_key=api_key,
                model="openai/gpt-4.1",
                debug=True,  # Enable debug mode
                timeout=360,  # 6 minute timeout for batch processing
                extra_config={
                    "response_format": OpenAISchema.response_format(BookmarkCategorization, "bookmark_categorization")
                }
            )
            self.client = BaseLLMClient(config, max_concurrent=400)  # High concurrency for batch processing
            logger.info("ML Categorizer initialized with OpenAI client (max_concurrent=400, timeout=360s)")
        except Exception as e:
            logger.error(f"Failed to initialize ML client: {e}")
            self.client = None
    
    def _validate_category_id(self, category_id: int) -> int:
        """Validate and fix category ID to ensure it exists in database"""
        if category_id in self.VALID_CATEGORIES:
            return category_id
        else:
            logger.warning(f"Invalid category_id {category_id}, defaulting to Uncategorized (7)")
            return 7  # Default to "Uncategorized"
    
    def _create_categorization_prompt(self, content: str) -> str:
        """Create a detailed prompt for AI categorization"""
        categories_text = "\n".join([f"{id}: {desc}" for id, desc in self.CATEGORY_DESCRIPTIONS.items()])
        
        return f"""Categorize this tweet/bookmark content into ONE SINGLE category from the list below:

{categories_text}

Content to categorize: "{content}"

RESPOND IN JSON FORMAT ONLY.
CRITICAL RULES:
- You MUST choose exactly ONE category ID (1-10)
- Do NOT return multiple category IDs
- Do NOT return arrays or lists of categories
- Only use category IDs 1, 2, 3, 4, 5, 6, 7, or 10
- Return valid JSON with no extra text

Required JSON format (example):
{{
  "tweet_content": "the original content",
  "prediction": {{
    "category_id": 6,
    "confidence": 0.85,
    "reasoning": "brief explanation"
  }},
  "categories_considered": [6, 1]
}}

Choose the SINGLE BEST category that fits the content."""
    
    async def categorize_bookmark(self, tweet_content: str) -> int:
        """
        Categorize a single bookmark using AI
        Returns the category ID (1-10)
        """
        if not self.client or not BHUMI_AVAILABLE:
            logger.debug("No AI client available, using fallback categorization")
            return self._fallback_categorize(tweet_content)
        
        try:
            # Create categories context for the AI
            categories_context = self._get_categories_context()
            
            system_prompt = self._create_categorization_prompt(tweet_content)

            logger.debug(f"Sending categorization request for: {tweet_content[:50]}...")
            
            response = await self.client.completion([
                {"role": "system", "content": system_prompt}
            ])
            
            logger.debug(f"Raw AI response type: {type(response)}")
            logger.debug(f"Raw AI response keys: {response.keys() if isinstance(response, dict) else 'Not a dict'}")
            
            # Parse and validate the response
            try:
                if not isinstance(response, dict) or 'text' not in response:
                    logger.error(f"Invalid response format: {response}")
                    return self._fallback_categorize(tweet_content)
                
                response_text = response["text"]
                logger.debug(f"Raw response text: {response_text[:200]}...")
                
                # Parse the JSON response directly (bhumi handles structured output)
                try:
                    result_data = json.loads(response_text)
                    logger.debug(f"Parsed JSON successfully: {result_data}")
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
                    return self._fallback_categorize(tweet_content)
                
                # Extract category from the structured response
                if "prediction" in result_data and isinstance(result_data["prediction"], dict):
                    category_id = result_data["prediction"].get("category_id")
                    confidence = result_data["prediction"].get("confidence", 0.0)
                    reasoning = result_data["prediction"].get("reasoning", "")
                    
                    if isinstance(category_id, (int, float)):
                        category_id = int(category_id)
                        if category_id in self.VALID_CATEGORIES:
                            logger.info(f"Successfully categorized: Category {category_id} (confidence: {confidence:.2f})")
                            return category_id
                        else:
                            logger.warning(f"Invalid category_id {category_id}, using fallback")
                            return self._fallback_categorize(tweet_content)
                
                # Fallback: Direct category object
                elif "category_id" in result_data:
                    category_id = result_data.get("category_id")
                    if isinstance(category_id, (int, float)):
                        category_id = int(category_id)
                        if category_id in self.VALID_CATEGORIES:
                            logger.info(f"Successfully categorized (direct): Category {category_id}")
                            return category_id
                
                logger.error(f"Could not extract valid category from: {result_data}")
                return self._fallback_categorize(tweet_content)
                
            except Exception as e:
                logger.error(f"Error processing AI response: {e}")
                return self._fallback_categorize(tweet_content)
        
        except Exception as e:
            logger.error(f"AI categorization failed: {e}")
            import traceback
            logger.debug(f"Full traceback: {traceback.format_exc()}")
            return self._fallback_categorize(tweet_content)
    
    def _extract_category_id_from_json(self, result_data: dict) -> Optional[int]:
        """Extract category ID from JSON response"""
        try:
            # Check for the expected structure
            if "prediction" in result_data and "category_id" in result_data["prediction"]:
                category_id = result_data["prediction"]["category_id"]
                confidence = result_data["prediction"].get("confidence", 0.0)
                reasoning = result_data["prediction"].get("reasoning", "")
                
                # Validate category_id exists in our categories
                if isinstance(category_id, (int, float)):
                    category_id = int(category_id)
                    if category_id in self.VALID_CATEGORIES:
                        logger.debug(f"JSON extraction: Category {category_id} (confidence: {confidence:.2f}) - {reasoning}")
                        return category_id
                    else:
                        logger.warning(f"AI returned invalid category_id {category_id}, using fallback")
                        return None
            
            # Check for simpler structure
            if "category_id" in result_data:
                category_id = result_data["category_id"]
                if isinstance(category_id, (int, float)):
                    category_id = int(category_id)
                    if category_id in self.VALID_CATEGORIES:
                        logger.debug(f"Simple JSON extraction: Category {category_id}")
                        return category_id
                    else:
                        logger.warning(f"AI returned invalid category_id {category_id}, using fallback")
                        return None
                
        except (ValueError, TypeError) as e:
            logger.error(f"Error extracting category from JSON: {e}")
        
        return None
    
    def _extract_category_from_text(self, text: str) -> Optional[int]:
        """Extract category ID from markdown-style text response"""
        import re
        
        # Look for patterns like "Category: 1001" or "Category:** 1001" or "1001. Technology"
        patterns = [
            r'category[:\s]*(\d+)',
            r'(\d+)\.\s*\w+',
            r'category_id[:\s]*(\d+)',
            r'id[:\s]*(\d+)'
        ]
        
        text_lower = text.lower()
        
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                try:
                    category_id = int(matches[0])
                    # Validate it's a valid category ID that exists in our database
                    if category_id in self.VALID_CATEGORIES:
                        logger.debug(f"Extracted category {category_id} from text using pattern: {pattern}")
                        return category_id
                    else:
                        logger.warning(f"Extracted invalid category_id {category_id} from text, trying next pattern")
                        continue
                except ValueError:
                    continue
        
        return None
    
    async def categorize_batch(self, bookmarks: List[Dict[str, Any]]) -> List[int]:
        """
        Categorize multiple bookmarks in batch using bhumi's efficient concurrent processing
        Returns list of category IDs
        """
        if not bookmarks:
            return []
            
        results = []
        
        if not self.client or not BHUMI_AVAILABLE:
            logger.debug("No AI client available, using fallback categorization for batch")
            # Use fallback for all bookmarks
            for bookmark in bookmarks:
                content = bookmark.get("tweet_content", bookmark.get("text", ""))
                results.append(self._fallback_categorize(content))
            return results
        
        # Process in larger batches to take advantage of bhumi's concurrency
        batch_size = 500  # Increased batch size for better efficiency with 400 concurrency
        total_bookmarks = len(bookmarks)
        
        logger.info(f"Processing {total_bookmarks} bookmarks in batches of {batch_size} with high concurrency")
        
        for i in range(0, total_bookmarks, batch_size):
            batch = bookmarks[i:i + batch_size]
            batch_tasks = []
            
            logger.debug(f"Processing batch {i//batch_size + 1}/{(total_bookmarks + batch_size - 1)//batch_size}")
            
            # Create concurrent tasks for this batch
            for bookmark in batch:
                content = bookmark.get("tweet_content", bookmark.get("text", ""))
                task = self.categorize_bookmark(content)
                batch_tasks.append(task)
            
            # Execute batch concurrently using asyncio.gather
            try:
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for result in batch_results:
                    if isinstance(result, Exception):
                        logger.error(f"Batch categorization error: {result}")
                        results.append(7)  # Default to "Uncategorized"
                    else:
                        results.append(result)
                        
                logger.debug(f"Completed batch {i//batch_size + 1}, processed {len(batch)} bookmarks")
                
            except Exception as batch_error:
                logger.error(f"Batch processing failed: {batch_error}")
                # Fallback for entire batch
                for bookmark in batch:
                    content = bookmark.get("tweet_content", bookmark.get("text", ""))
                    results.append(self._fallback_categorize(content))
            
            # Small delay between large batches to be respectful to API
            if i + batch_size < total_bookmarks:
                await asyncio.sleep(1.0)
        
        logger.info(f"Batch categorization complete: {len(results)} bookmarks processed")
        return results
    
    def _fallback_categorize(self, tweet_content: str) -> int:
        """Fallback categorization using keyword matching"""
        if not tweet_content:
            return 7  # Default to "Uncategorized"
        
        content_lower = tweet_content.lower()
        category_scores = {}
        
        # Define keywords for each category
        category_keywords = {
            1: ["content", "ideas", "creative", "inspiration", "brainstorm", "writing", "post", "social media", "marketing", "strategy"],
            2: ["automation", "tools", "workflow", "productivity", "efficiency", "script", "bot", "api", "integration", "software", "app"],
            3: ["article", "read", "blog", "interesting", "worth reading", "study", "research", "learning", "thread", "story"],
            4: ["career", "advice", "tips", "professional", "work", "interview", "resume", "networking", "development"],
            5: ["quote", "wisdom", "inspiration", "motivational", "saying", "philosophy", "life advice", "insightful"],
            6: ["fact", "trivia", "knowledge", "learn", "study", "research", "science", "technology", "ai", "programming", "tech", "data"],
            7: ["misc", "random", "general", "other", "uncategorized"],
            10: ["job", "hiring", "opportunity", "position", "employment", "recruit", "opening", "apply", "posting", "announcement"]
        }
        
        for category_id, keywords in category_keywords.items():
            score = 0
            for keyword in keywords:
                if keyword in content_lower:
                    score += 1
            category_scores[category_id] = score
        
        # Return category with highest score, or default to 7 if no matches
        if category_scores and max(category_scores.values()) > 0:
            best_category = max(category_scores, key=category_scores.get)
            logger.debug(f"Fallback categorization: '{tweet_content[:50]}...' -> Category {best_category}")
            return best_category
        else:
            logger.debug(f"Fallback categorization: No keywords matched, using Uncategorized (7)")
            return 7
    
    def _get_categories_context(self):
        """Generate a formatted string of categories for the AI prompt"""
        context_lines = []
        for cat_id, description in self.CATEGORY_DESCRIPTIONS.items():
            context_lines.append(f"{cat_id}. {description}")
        return "\n".join(context_lines)
    
    def _clean_json_response(self, text: str) -> str:
        """Clean JSON response by removing markdown code blocks"""
        if not text:
            return ""
            
        text = text.strip()
        
        # Remove markdown code blocks
        if text.startswith("```") and text.endswith("```"):
            lines = text.split("\n")
            if len(lines) > 2:
                # Remove first and last lines (```json and ```)
                text = "\n".join(lines[1:-1])
        
        # Also handle single line ```json{...}```
        if text.startswith("```json") and text.endswith("```"):
            text = text[7:-3]  # Remove ```json and ```
        elif text.startswith("```") and text.endswith("```"):
            text = text[3:-3]  # Remove ``` and ```
        
        return text.strip()

# Global categorizer instance
_categorizer = None

def get_categorizer() -> MLCategorizer:
    """Get or create the global categorizer instance"""
    global _categorizer
    if _categorizer is None:
        _categorizer = MLCategorizer()
    return _categorizer

async def categorize_content(content: str) -> int:
    """Convenience function to categorize a single piece of content"""
    categorizer = get_categorizer()
    return await categorizer.categorize_bookmark(content)

async def categorize_multiple(contents: List[str]) -> List[int]:
    """Convenience function to categorize multiple pieces of content"""
    categorizer = get_categorizer()
    bookmarks = [{"tweet_content": content} for content in contents]
    return await categorizer.categorize_batch(bookmarks) 