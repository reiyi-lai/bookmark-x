import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_URL } from "./config";

export async function apiRequest<T = any>(
  options: {
    endpoint: string;
    method: string;
    data?: unknown;
    on401: "returnNull" | "throw";
  }
): Promise<T> {
  const { endpoint, method, data } = options;
  
  // Construct full URL - if endpoint already has protocol, use as is, otherwise prepend API_URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  // Get twitter_id from sessionStorage for authentication
  const twitterId = sessionStorage.getItem('twitter_user_id');
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add authentication header if available
  if (twitterId) {
    headers["x-twitter-id"] = twitterId;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (options.on401 === "returnNull" && res.status === 401) {
    return null as T;
  }

  // Handle error responses
  if (!res.ok) {
    let errorMessage = res.statusText;
    
    try {
      // Try to parse JSON error response
      const errorData = await res.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // If not JSON, fall back to text
      try {
        const text = await res.text();
        if (text) {
          errorMessage = text;
        }
      } catch (textError) {
        // Keep the statusText if everything else fails
      }
    }
    
    const error = new Error(errorMessage);
    // @ts-ignore - Add status code to error for debugging
    error.status = res.status;
    throw error;
  }
  
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Construct full URL - if queryKey already has protocol, use as is, otherwise prepend API_URL
    const endpoint = queryKey[0] as string;
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    // Get twitter_id from sessionStorage for authentication
    const twitterId = sessionStorage.getItem('twitter_user_id');
    const headers: Record<string, string> = {};
    
    // Add authentication header if available
    if (twitterId) {
      headers["x-twitter-id"] = twitterId;
    }
    
    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Handle error responses
    if (!res.ok) {
      let errorMessage = res.statusText;
      
      try {
        // Try to parse JSON error response
        const errorData = await res.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // If not JSON, fall back to text
        try {
          const text = await res.text();
          if (text) {
            errorMessage = text;
          }
        } catch (textError) {
          // Keep the statusText if everything else fails
        }
      }
      
      const error = new Error(errorMessage);
      // @ts-ignore - Add status code to error for debugging
      error.status = res.status;
      throw error;
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
