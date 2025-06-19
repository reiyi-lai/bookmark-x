import asyncio
import re
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import spacy

class BookmarkCategorizer:
    """
    Advanced bookmark categorization using multiple ML approaches:
    1. Sentence transformers for semantic similarity
    2. TF-IDF with cosine similarity for keyword matching
    3. Rule-based patterns for specific content types
    """
    
    def __init__(self):
        self.sentence_model = None
        self.nlp = None
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            lowercase=True
        )
        
        # Keyword sets for different categories (migrated from your current system)
        self.keyword_sets = {
            'quotes': [
                'quote', 'quotes', 'saying', 'wisdom', 'inspirational', 'motivational',
                'words', 'phrase', 'proverb', 'famous', 'speech', 'cited', 'statement',
                'words of wisdom', '"', '"'
            ],
            'automation tools': [
                'tool', 'automation', 'script', 'app', 'platform', 'software', 'bot',
                'workflow', 'efficiency', 'productivity', 'code', 'programming', 'tech',
                'api', 'saas', 'service'
            ],
            'career tips': [
                'job', 'career', 'work', 'interview', 'resume', 'hire', 'hiring',
                'professional', 'promotion', 'workplace', 'skills', 'networking',
                'leadership', 'management', 'salary', 'negotiation', 'job search',
                'cv', 'linkedin', 'professional development', 'mentorship', 'coaching'
            ],
            'interesting reads': [
                'read', 'article', 'blog', 'post', 'interesting', 'fascinating',
                'story', 'book', 'novel', 'publication', 'magazine', 'journal',
                'research', 'study', 'paper', 'analysis'
            ],
            'content ideas': [
                'idea', 'content', 'blog', 'post', 'article', 'write', 'writing',
                'topic', 'inspiration', 'creative', 'create', 'concept', 'brainstorm',
                'strategy', 'marketing'
            ],
            'job opportunities': [
                'hiring', 'looking for', 'seeking', 'recruiting', 'job opening',
                'position available', 'we are hiring', 'join our team', 'apply now',
                'intern', 'internship', 'full-time', 'part-time', 'remote', 'on-site',
                'contract', 'freelance', 'opportunity', 'vacancy', 'talent', 'candidate',
                'role', 'dm me', 'send resume', 'portfolio', 'employment'
            ],
            'general knowledge': [
                'fact', 'trivia', 'knowledge', 'learn', 'know', 'education',
                'history', 'science', 'culture', 'information', 'data', 'discover',
                'interesting fact', 'did you know', 'tip', 'how to'
            ]
        }
    
    async def initialize(self):
        """Initialize ML models asynchronously"""
        print("🔄 Initializing ML models...")
        
        # Load sentence transformer model
        try:
            self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✅ Sentence transformer model loaded")
        except Exception as e:
            print(f"⚠️  Failed to load sentence transformer: {e}")
            self.sentence_model = None
        
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_sm")
            print("✅ SpaCy model loaded")
        except Exception as e:
            print(f"⚠️  Failed to load spaCy model: {e}")
            try:
                # Try to download and load the model
                import subprocess
                subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], 
                             check=True, capture_output=True)
                self.nlp = spacy.load("en_core_web_sm")
                print("✅ SpaCy model downloaded and loaded")
            except Exception as e2:
                print(f"⚠️  Could not download spaCy model: {e2}")
                self.nlp = None
    
    def preprocess_text(self, text: str) -> str:
        """Clean and preprocess text for analysis"""
        if not text:
            return ""
        
        # Basic cleaning
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Use spaCy for better preprocessing if available
        if self.nlp:
            doc = self.nlp(text)
            # Extract lemmatized tokens, excluding stop words and punctuation
            tokens = [token.lemma_.lower() for token in doc 
                     if not token.is_stop and not token.is_punct and token.is_alpha]
            return ' '.join(tokens)
        
        return text.lower()
    
    def keyword_score(self, text: str, category_name: str) -> float:
        """Calculate keyword-based score for a category"""
        text_lower = text.lower()
        category_keywords = self.keyword_sets.get(category_name.lower(), [])
        
        if not category_keywords:
            return 0.0
        
        matches = sum(1 for keyword in category_keywords if keyword in text_lower)
        return matches / len(category_keywords)
    
    def rule_based_score(self, text: str, category_name: str) -> float:
        """Apply rule-based scoring for specific patterns"""
        text_lower = text.lower()
        category_lower = category_name.lower()
        
        # Special rules for quotes
        if 'quote' in category_lower:
            if (text.count('"') >= 2 or text.count('"') >= 1 or 
                text.count('"') >= 1 or re.match(r'^".*"$', text.strip())):
                return 1.0
        
        # Special rules for job opportunities
        if 'job' in category_lower or 'opportunity' in category_lower:
            job_indicators = ['hiring', 'looking for', 'join our team', 'apply now', 'dm me']
            if any(indicator in text_lower for indicator in job_indicators):
                return 0.8
        
        # Long text likely to be interesting reads
        if 'read' in category_lower or 'article' in category_lower:
            if len(text) > 500:
                return 0.3
        
        return 0.0
    
    async def categorize(self, text: str, categories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Categorize a single text using multiple approaches"""
        if not text or not categories:
            return self._default_result(categories)
        
        processed_text = self.preprocess_text(text)
        if not processed_text:
            return self._default_result(categories)
        
        scores = {}
        
        for category in categories:
            cat_id = category['id']
            cat_name = category['name']
            cat_desc = category.get('description', '')
            
            # Combine category name and description for comparison
            category_text = f"{cat_name} {cat_desc}".strip()
            
            # 1. Keyword-based scoring
            keyword_score = self.keyword_score(text, cat_name)
            
            # 2. Rule-based scoring
            rule_score = self.rule_based_score(text, cat_name)
            
            # 3. Semantic similarity using sentence transformers
            semantic_score = 0.0
            if self.sentence_model and category_text:
                try:
                    text_embedding = self.sentence_model.encode([processed_text])
                    category_embedding = self.sentence_model.encode([category_text])
                    semantic_score = cosine_similarity(text_embedding, category_embedding)[0][0]
                except Exception as e:
                    print(f"Semantic similarity error: {e}")
            
            # 4. TF-IDF similarity (if we have multiple categories to compare)
            tfidf_score = 0.0
            if len(categories) > 1:
                try:
                    all_texts = [processed_text] + [f"{cat['name']} {cat.get('description', '')}" 
                                                   for cat in categories]
                    tfidf_matrix = self.tfidf_vectorizer.fit_transform(all_texts)
                    similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])
                    cat_index = next(i for i, cat in enumerate(categories) if cat['id'] == cat_id)
                    tfidf_score = similarities[0][cat_index]
                except Exception as e:
                    print(f"TF-IDF similarity error: {e}")
            
            # Combine scores with weights
            combined_score = (
                keyword_score * 0.3 +
                rule_score * 0.3 +
                semantic_score * 0.25 +
                tfidf_score * 0.15
            )
            
            scores[cat_id] = {
                'score': combined_score,
                'name': cat_name,
                'breakdown': {
                    'keyword': keyword_score,
                    'rule': rule_score,
                    'semantic': semantic_score,
                    'tfidf': tfidf_score
                }
            }
        
        # Find best category
        best_cat_id = max(scores.keys(), key=lambda k: scores[k]['score'])
        best_score = scores[best_cat_id]['score']
        
        # If confidence is too low, use default category
        if best_score < 0.1:
            return self._default_result(categories)
        
        return {
            'category_id': best_cat_id,
            'category_name': scores[best_cat_id]['name'],
            'confidence': min(best_score, 1.0),
            'debug_scores': scores
        }
    
    async def categorize_batch(self, texts: List[str], categories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Categorize multiple texts efficiently"""
        if not texts:
            return []
        
        # For now, process sequentially. Could be optimized with proper batching
        results = []
        for text in texts:
            result = await self.categorize(text, categories)
            results.append(result)
        
        return results
    
    def _default_result(self, categories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return default categorization result"""
        # Try to find 'uncategorized' category
        default_cat = next(
            (cat for cat in categories if 'uncategorized' in cat['name'].lower()),
            categories[0] if categories else {'id': 1, 'name': 'Uncategorized'}
        )
        
        return {
            'category_id': default_cat['id'],
            'category_name': default_cat['name'],
            'confidence': 0.0
        } 