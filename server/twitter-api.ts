import { z } from 'zod';

// Twitter API response schema for bookmarks
const twitterBookmarkResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    text: z.string(),
    created_at: z.string().datetime(),
    author_id: z.string(),
  })).optional(),
  includes: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
      username: z.string(),
      profile_image_url: z.string().optional(),
    })),
  }).optional(),
  meta: z.object({
    result_count: z.number(),
    next_token: z.string().optional(),
  }).optional(),
});

const twitterErrorResponseSchema = z.object({
  errors: z.array(z.object({
    message: z.string(),
    code: z.number(),
  })),
});

type TwitterBookmarkResponse = z.infer<typeof twitterBookmarkResponseSchema>;
type TwitterErrorResponse = z.infer<typeof twitterErrorResponseSchema>;

export interface TwitterBookmark {
  tweetId: string;
  authorName: string;
  authorUsername: string;
  authorProfileImage?: string | null;
  content: string;
  createdAt: Date;
  url: string;
}

export class TwitterApiClient {
  private baseUrl = 'https://api.twitter.com/2';

  constructor(private accessToken: string) {}

  async fetchBookmarks(
    userId: string,
    paginationToken?: string,
    maxResults: number = 100,
  ): Promise<{ bookmarks: TwitterBookmark[], nextToken?: string }> {
    try {
      // Construct URL with query parameters
      const url = new URL(`${this.baseUrl}/users/${userId}/bookmarks`);
      url.searchParams.append('max_results', maxResults.toString());
      url.searchParams.append('expansions', 'author_id');
      url.searchParams.append('tweet.fields', 'created_at');
      url.searchParams.append('user.fields', 'name,username,profile_image_url');

      if (paginationToken) {
        url.searchParams.append('pagination_token', paginationToken);
      }

      // Make request to Twitter API
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        const parsedError = twitterErrorResponseSchema.safeParse(data);
        if (parsedError.success) {
          throw new Error(`Twitter API error: ${parsedError.data.errors[0].message}`);
        } else {
          throw new Error(`Twitter API error: ${response.statusText}`);
        }
      }

      // Parse and validate response
      const parsedResponse = twitterBookmarkResponseSchema.parse(data);
      
      // If no data, return empty array
      if (!parsedResponse.data || !parsedResponse.includes) {
        return { bookmarks: [] };
      }

      // Map Twitter API response to our internal format
      const bookmarks = parsedResponse.data.map(tweet => {
        const author = parsedResponse.includes!.users.find(user => user.id === tweet.author_id);
        
        if (!author) {
          throw new Error(`Author not found for tweet: ${tweet.id}`);
        }

        return {
          tweetId: tweet.id,
          authorName: author.name,
          authorUsername: author.username,
          authorProfileImage: author.profile_image_url,
          content: tweet.text,
          createdAt: new Date(tweet.created_at),
          url: `https://twitter.com/${author.username}/status/${tweet.id}`,
        };
      });

      return {
        bookmarks,
        nextToken: parsedResponse.meta?.next_token,
      };
    } catch (error) {
      console.error('Error fetching bookmarks from Twitter API:', error);
      throw error;
    }
  }

  async getUser(): Promise<{ id: string, username: string, name: string }> {
    try {
      const url = `${this.baseUrl}/users/me`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data.id) {
        throw new Error('Invalid response from Twitter API');
      }

      return {
        id: data.data.id,
        username: data.data.username,
        name: data.data.name,
      };
    } catch (error) {
      console.error('Error fetching user data from Twitter API:', error);
      throw error;
    }
  }

  // Helper method to categorize bookmarks based on content
  static categorizeBookmark(content: string): number {
    // Default to uncategorized (assuming it's the last category with ID 7)
    let categoryId = 7;

    const contentLower = content.toLowerCase();

    // Simple keyword matching for categorization
    if (contentLower.includes('idea') || contentLower.includes('content') || contentLower.includes('strategy')) {
      categoryId = 1; // Content Ideas
    } else if (contentLower.includes('tool') || contentLower.includes('automation') || contentLower.includes('workflow')) {
      categoryId = 2; // Automation Tools
    } else if (contentLower.includes('article') || contentLower.includes('read') || contentLower.includes('blog')) {
      categoryId = 3; // Interesting Reads
    } else if (contentLower.includes('career') || contentLower.includes('job') || contentLower.includes('skill')) {
      categoryId = 4; // Career Tips
    } else if (contentLower.includes('quote') || contentLower.includes('"') || contentLower.includes('"')) {
      categoryId = 5; // Good Quotes
    } else if (contentLower.includes('fact') || contentLower.includes('trivia') || contentLower.includes('did you know')) {
      categoryId = 6; // Knowledge/Trivia
    }

    return categoryId;
  }
}

export async function getAccessToken(code: string): Promise<{ accessToken: string, refreshToken: string, expiresIn: number }> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing TWITTER_CLIENT_ID environment variable');
  }

  const redirectUri = process.env.TWITTER_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri);
  params.append('code_verifier', 'challenge'); // This should be stored in the session

  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitter OAuth error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
}

export function getAuthUrl(): string {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing TWITTER_CLIENT_ID environment variable');
  }

  const redirectUri = process.env.TWITTER_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

  const scopes = ['tweet.read', 'users.read', 'bookmark.read'];
  
  const state = Math.random().toString(36).substring(2, 15); // Random state
  const challenge = 'challenge'; // This should be generated and stored in the session
  
  const url = new URL('https://twitter.com/i/oauth2/authorize');
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('client_id', clientId);
  url.searchParams.append('redirect_uri', redirectUri);
  url.searchParams.append('scope', scopes.join(' '));
  url.searchParams.append('state', state);
  url.searchParams.append('code_challenge', challenge);
  url.searchParams.append('code_challenge_method', 'plain');
  
  return url.toString();
}
