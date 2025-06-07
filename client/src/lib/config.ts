// API Configuration
const getApiUrl = () => {
  // In production (when deployed), use the production API
  if (import.meta.env.PROD) {
    return 'https://bookmark-x.info';
  }
  
  // In development, use localhost
  return 'http://localhost:3000';
};

export const API_URL = getApiUrl();

// Environment variables
export const config = {
  apiUrl: API_URL,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
}; 