import natural from 'natural';
import { removeStopwords } from 'stopword';
import { Category } from '@shared/schema';
import { InferenceClient } from '@huggingface/inference';

const { TfIdf } = natural;

/**
 * Utility class for keyword matching
 */
class KeywordMatcher {
  /**
   * Check if text contains any of the given keywords
   */
  static containsKeywords(text: string, keywords: string[]): boolean {
    const lowercaseText = text.toLowerCase();
    return keywords.some(keyword => lowercaseText.includes(keyword.toLowerCase()));
  }
  
  /**
   * Find a category by keyword matching
   */
  static findCategoryByKeywords(categories: Category[], text: string, keywordSets: Record<string, string[]>): Category | undefined {
    const lowercaseText = text.toLowerCase();
    
    // Check each category against its keyword set
    for (const [categoryName, keywords] of Object.entries(keywordSets)) {
      if (this.containsKeywords(lowercaseText, keywords)) {
        // Find the matching category
        return categories.find(c => 
          c.name.toLowerCase() === categoryName.toLowerCase() ||
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase())
        );
      }
    }
    
    return undefined;
  }
  
  /**
   * Get predefined keyword sets for different categories
   */
  static getKeywordSets(): Record<string, string[]> {
    return {
      'quotes': ['"', '"', 'said ', 'says ', 'quote', 'quotes', 'saying', 'wisdom', 'inspirational', 'motivational', 
                'words', 'phrase', 'proverb', 'famous', 'speech', 'cited', 'told', 'statement', 'words of wisdom'],
      'automation tools': ['tool', 'automation', 'script', 'app ', 'platform', 'software', 'bot', 'workflow', 'efficiency',
                          'productivity', 'code', 'programming', 'tech'],
      'career tips': ['job', 'career', 'work', 'interview', 'resume', 'hire', 'hiring', 'professional', 'promotion',
                     'workplace', 'skills', 'networking', 'leadership', 'management', 'salary', 'negotiation',
                     'job search', 'cv', 'linkedin', 'professional development', 'mentorship', 'coaching'],
      'interesting reads': ['read', 'article', 'blog', 'post', 'interesting', 'fascinating', 'story', 'book', 'novel',
                           'publication', 'magazine', 'journal'],
      'content ideas': ['idea', 'content', 'blog', 'post', 'article', 'write', 'writing', 'topic', 'inspiration', 'creative', 
                       'create', 'concept'],
      'job opportunities': ['hiring', 'looking for', 'seeking', 'recruiting', 'job opening', 'position available', 
                                  'we are hiring', 'join our team', 'apply now', 'intern', 'internship', 'full-time', 
                                  'part-time', 'remote', 'on-site', 'contract', 'freelance', 'opportunity', 'vacancy',
                                  'talent', 'candidate', 'role', 'dm me', 'send resume', 'cv', 'portfolio', 'opening',
                                  'job search', 'employment', 'work opportunity', 'join us'],
      'general knowledge': ['fact', 'trivia', 'knowledge', 'learn', 'know', 'education', 'history', 'science', 'culture',
                           'information', 'data', 'study', 'research', 'discover', 'interesting fact', 'did you know']
    };
  }

  /**
   * Get keyword sets mapped by category ID
   * @param categories List of categories to map keywords to
   * @returns Record mapping category IDs to keyword arrays
   */
  static getKeywordSetsById(categories: Category[]): Record<number, string[]> {
    const keywordMap: Record<number, string[]> = {};
    const keywordSets = this.getKeywordSets();
    
    // Map category names to their IDs
    categories.forEach(category => {
      const categoryName = category.name.toLowerCase();
      
      // Find matching keyword set
      for (const [keywordSetName, keywords] of Object.entries(keywordSets)) {
        if (categoryName === keywordSetName.toLowerCase() || 
            categoryName.includes(keywordSetName.toLowerCase()) || 
            keywordSetName.toLowerCase().includes(categoryName)) {
          keywordMap[category.id] = keywords;
          break;
        }
      }
      
      // If no match found, use default keywords
      if (!keywordMap[category.id]) {
          keywordMap[category.id] = [category.name.toLowerCase()];
      }
    });

    return keywordMap;
  }
}

/**
 * Interface for all categorizer implementations
 */
interface Categorizer {
  /**
   * Attempt to categorize the given text
   * @param text The text to categorize
   * @returns The category ID if successful, null if this categorizer cannot handle the text
   */
  categorize(text: string): Promise<number | null>;
  
  /**
   * Set the next categorizer in the chain
   * @param next The next categorizer to try if this one fails
   */
  setNext(next: Categorizer): void;
  
  /**
   * Get the default category ID to use when categorization fails
   * @returns The ID of the default category
   */
  getDefaultCategoryId(): number;
}

/**
 * Base abstract class for categorizers that implements common functionality
 */
abstract class BaseCategorizer implements Categorizer {
  protected nextCategorizer: Categorizer | null = null;
  protected categories: Category[];
  
  constructor(categories: Category[]) {
    this.categories = categories;
  }
  
  setNext(next: Categorizer): void {
    this.nextCategorizer = next;
  }
  
  /**
   * Helper method to find a category by name
   */
  protected findCategoryByName(name: string): Category | undefined {
    return this.categories.find(c => 
      c.name.toLowerCase() === name.toLowerCase()
    );
  }
  
  /**
   * Helper method to find a category by partial name match
   */
  protected findCategoryByPartialName(name: string): Category | undefined {
    return this.categories.find(c => 
      c.name.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(c.name.toLowerCase())
    );
  }
  
  /**
   * Get the default category ID
   */
  public getDefaultCategoryId(): number {
    const uncategorized = this.categories.find(c => 
      c.name.toLowerCase() === 'uncategorized'
    );
    return uncategorized ? uncategorized.id : this.categories[0].id;
  }
  
  /**
   * Abstract method to be implemented by concrete categorizers
   */
  abstract categorize(text: string): Promise<number | null>;
}

/**
 * DeepSeek model-based categorizer
 */
class DeepSeekCategorizer extends BaseCategorizer {
  private modelId: string;
  private provider: string;
  private client: InferenceClient;
  
  constructor(categories: Category[], apiKey: string) {
    super(categories);
    // Use a model that's available through Hugging Face inference providers
    this.provider = 'novita';
    this.modelId = 'deepseek-ai/DeepSeek-V3-0324';
    this.client = new InferenceClient(apiKey);
  }
  
  async categorize(text: string): Promise<number | null> {
    try {
      console.log('Trying DeepSeek model categorization...');
      const prompt = this.createPrompt(text);
      
      const result = await this.client.chatCompletion({
        provider: this.provider,
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }]
      });
      
      let generatedText = '';
      
      if (result && result.choices && result.choices.length > 0) {
        generatedText = result.choices[0].message.content || '';
      }
      
      console.log(`DeepSeek model response: ${generatedText}`);
      
      const predictedCategory = this.parseResponse(generatedText);
      console.log(`Parsed category: ${predictedCategory}`);
      
      // Try to find an exact match first
      const category = this.findCategoryByName(predictedCategory);
      if (category) {
        console.log(`Mapped to category ID: ${category.id}`);
        return category.id;
      }
      
      // Try partial match
      const partialCategory = this.findCategoryByPartialName(predictedCategory);
      if (partialCategory) {
        console.log(`Mapped to category ID (partial match): ${partialCategory.id}`);
        return partialCategory.id;
      }
      
      console.log('DeepSeek model did not find a matching category, falling back to TF-IDF');
      return null;
    } catch (error) {
      console.error(`Error with DeepSeek model:`, error);
      return null;
    }
  }
  
  private createPrompt(text: string): string {
    const categoryList = this.categories
      .map(c => `- ${c.name}: ${c.description || ''}`)
      .join('\n');
    
    return `You are a bookmark categorization assistant. Given the following text, categorize it into one of these categories:

${categoryList}

Text to categorize: "${text}"

Respond with ONLY the category name, nothing else.`;
  }
  
  private parseResponse(response: string): string {
    // Clean up the response
    console.log("Raw model response:", response);
    
    // Mixtral should respond with just the category name, but let's handle other cases too
    const cleanedResponse = response.trim();
    
    // If no match found, take the first line
    const firstLine = cleanedResponse.split('\n')[0].trim();
    return firstLine;
  }
}

/**
 * Enhanced TF-IDF based categorizer with integrated keyword matching
 */
class TfIdfCategorizer extends BaseCategorizer {
  private tfidf: any; // Using any to avoid TypeScript errors with natural library
  private keywordsByCategory: Record<number, string[]>;
  private keywordSets: Record<string, string[]>;
  
  constructor(categories: Category[]) {
    super(categories);
    this.tfidf = new TfIdf();
    this.keywordSets = KeywordMatcher.getKeywordSets();
    this.keywordsByCategory = KeywordMatcher.getKeywordSetsById(categories);
    this.trainModel();
  }
  
  async categorize(text: string): Promise<number | null> {
    console.log('Using TF-IDF with keyword matching for categorization...');
    
    // Preprocess the text
    const tokens = this.preprocessText(text);
    
    // Skip categorization for empty text
    if (tokens.length === 0) {
      return this.getDefaultCategoryId();
    }
    
    // Calculate initial scores
    let scores = this.calculateCategoryScores(tokens);
    
    // Apply keyword matching to boost scores
    scores = this.applyKeywordMatching(text, scores);
    
    // Find the category with the highest score
    let bestCategoryId = this.getDefaultCategoryId();
    let highestScore = -1;
    
    Object.entries(scores).forEach(([categoryId, score]) => {
      if (score > highestScore) {
        highestScore = score;
        bestCategoryId = Number(categoryId);
      }
    });
    
    // Log the categorization result
    const bestCategory = this.categories.find(c => c.id === bestCategoryId);
    console.log(`TF-IDF with keyword matching categorized as: ${bestCategory?.name || 'Unknown'} (score: ${highestScore})`);
    
    return bestCategoryId;
  }

  /**
   * Train the TF-IDF model with category keywords
   */
  private trainModel(): void {
    // Add category descriptions and keywords to the model
    this.categories.forEach(category => {
      const id = category.id;
      const keywords = this.keywordsByCategory[id] || [];
      
      // Add the category name and description
      this.tfidf.addDocument(`${category.name} ${category.description || ''}`);
      
      // Add keywords with repetition for higher weight
      if (keywords.length > 0) {
        this.tfidf.addDocument(keywords.join(' '));
        // Add twice for increased weighting
        this.tfidf.addDocument(keywords.join(' '));
      }
    });
  }

  /**
   * Preprocess text by removing stopwords and converting to lowercase
   */
  private preprocessText(text: string): string[] {
    // Convert to lowercase
    const lowercaseText = text.toLowerCase();
    
    // Split by non-alphanumeric characters and filter out empty strings
    const tokens = lowercaseText
      .split(/[^a-z0-9]/)
      .filter(token => token.length > 0);
    
    // Remove stopwords
    return removeStopwords(tokens);
  }

  /**
   * Calculate category scores based on TF-IDF analysis
   */
  private calculateCategoryScores(tokens: string[]): Record<number, number> {
    const scores: Record<number, number> = {};
    
    // Initialize scores for all categories
    this.categories.forEach(category => {
      scores[category.id] = 0;
    });
    
    // Process each token and aggregate scores
    tokens.forEach(token => {
      this.categories.forEach((category, idx) => {
        // Check token similarity with category keywords
        const keywordMatch = this.keywordsByCategory[category.id].some(
          keyword => keyword.includes(token) || token.includes(keyword)
        );
        
        // Add score for keyword match
        if (keywordMatch) {
          scores[category.id] += 1;
        }
        
        // Check TF-IDF similarity
        const similarity = this.tfidf.tfidf(token, idx);
        scores[category.id] += similarity;
      });
    });
    
    return scores;
  }

  /**
   * Apply keyword matching to boost scores
   */
  private applyKeywordMatching(text: string, scores: Record<number, number>): Record<number, number> {
    const updatedScores = { ...scores };
    
    // Apply keyword-based scoring
    for (const [categoryName, keywords] of Object.entries(this.keywordSets)) {
      if (KeywordMatcher.containsKeywords(text, keywords)) {
        // Find the matching category
        const category = this.categories.find(c => 
          c.name.toLowerCase() === categoryName.toLowerCase() ||
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase())
        );
        
        if (category) {
          // Boost the score for this category
          updatedScores[category.id] += 3;
          console.log(`Keyword match found for category: ${category.name}`);
        }
      }
    }
    
    // Special case for quotes (check for quotation marks)
    if (text.includes('"') || text.includes('"') || text.match(/^".*"$/)) {
      const quoteCategory = this.categories.find(c => 
        c.name.toLowerCase() === 'quotes' || 
        c.name.toLowerCase() === 'good quotes'
      );
      
      if (quoteCategory) {
        updatedScores[quoteCategory.id] += 5; // Strong boost for quotes
        console.log(`Quotation marks detected, boosting quotes category`);
      }
    }
    
    // Special case for longer texts (likely interesting reads)
    if (text.length > 500) {
      const readsCategory = this.categories.find(c => 
        c.name.toLowerCase().includes('read') || 
        c.name.toLowerCase().includes('article') || 
        c.name.toLowerCase().includes('interesting')
      );
      
      if (readsCategory) {
        updatedScores[readsCategory.id] += 2; // Moderate boost for longer texts
        console.log(`Long text detected (${text.length} chars), boosting interesting reads category`);
      }
    }
    
    return updatedScores;
  }
}

  /**
 * Main categorizer class that orchestrates the chain of responsibility
 */
export class MLCategorizer {
  private firstCategorizer: Categorizer;
  
  constructor(categories: Category[], apiKey: string) {
    // Create the chain of categorizers
    const deepSeekCategorizer = new DeepSeekCategorizer(categories, apiKey);
    const tfIdfCategorizer = new TfIdfCategorizer(categories);
    
    // Set up the chain
    deepSeekCategorizer.setNext(tfIdfCategorizer);
    
    this.firstCategorizer = deepSeekCategorizer;
  }
  
  /**
   * Categorize text using the chain of responsibility
   */
  public async categorize(text: string): Promise<number> {
    let currentCategorizer: Categorizer | null = this.firstCategorizer;
    let result: number | null = null;
    
    // Try each categorizer in the chain until one succeeds
    while (currentCategorizer && result === null) {
      result = await currentCategorizer.categorize(text);
      
      if (result === null) {
        // Move to the next categorizer in the chain
        currentCategorizer = (currentCategorizer as any).nextCategorizer;
      }
    }
    
    // If all categorizers failed, return the default category
    return result || this.firstCategorizer.getDefaultCategoryId();
  }
}

/**
 * Helper function to create a categorizer with given categories
 */
export function createCategorizer(categories: Category[]): MLCategorizer {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    console.warn('HUGGINGFACE_API_KEY not found in environment variables. Using fallback categorization only.');
    return new MLCategorizer(categories, '');
  }
  
  return new MLCategorizer(categories, apiKey);
}