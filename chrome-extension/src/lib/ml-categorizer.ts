import { Category } from '@shared/schema';

export interface CategorizeRequest {
  content: string;
  url: string;
  author: string;
}

export interface CategorizeResponse {
  categoryId: number;
  confidence: number;
  category: string;
}

// This communicates with the existing BookmarkBuddy ML API
export class MLCategorizerClient {
  private apiUrl: string;

  constructor(apiUrl = 'http://localhost:5000') {
    this.apiUrl = apiUrl;
  }

  async categorizeBookmark(request: CategorizeRequest, categories: Category[]): Promise<number | null> {
    try {
      // Use the existing ML categorizer endpoint from the main app
      const response = await fetch(`${this.apiUrl}/api/categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.content,
          categories: categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`ML API request failed: ${response.status}`);
      }

      const result = await response.json() as CategorizeResponse;
      return result.categoryId || null;
    } catch (error) {
      console.error('ML categorization failed:', error);
      // Fall back to default category
      const defaultCategory = categories.find(cat => cat.name === 'Uncategorized');
      return defaultCategory ? defaultCategory.id : null;
    }
  }

  async categorizeMultiple(requests: CategorizeRequest[], categories: Category[]): Promise<(number | null)[]> {
    try {
      // Batch processing - call individual categorization for each
      // The main app doesn't have a batch endpoint yet, so we'll process individually
      return Promise.all(
        requests.map(request => this.categorizeBookmark(request, categories))
      );
    } catch (error) {
      console.error('ML batch categorization failed:', error);
      // Fall back to individual categorization
      return Promise.all(
        requests.map(request => this.categorizeBookmark(request, categories))
      );
    }
  }
}

export const mlCategorizer = new MLCategorizerClient();
