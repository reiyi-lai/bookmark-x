import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_URL } from "./config";

function getAuthHeaders(includeContentType = false, data?: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType && data) {
    headers["Content-Type"] = "application/json";
  }
  const twitterId = localStorage.getItem('twitter_user_id');
  if (twitterId) {
    headers["x-twitter-id"] = twitterId;
  }
  
  return headers;
}

// Extract error message from API response
async function handleErrorResponse(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.message || data.error;
  } catch {
    return res.statusText;
  }
}

export async function apiRequest<T = any>(
  options: {
    endpoint: string;
    method: string;
    data?: unknown;
    on401: "returnNull" | "throw";
  }
): Promise<T> {
  const { endpoint, method, data, on401 } = options;
  
  // Construct full URL - if endpoint already has protocol, use as is, otherwise prepend API_URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  const headers = getAuthHeaders(true, data);
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (on401 === "returnNull" && res.status === 401) {
    return null as T;
  }

  if (!res.ok) {
    const errorMessage = await handleErrorResponse(res);
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
    const endpoint = queryKey[0] as string;
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    const headers = getAuthHeaders();
    
    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      const errorMessage = await handleErrorResponse(res);
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
