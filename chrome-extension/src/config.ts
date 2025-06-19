// Chrome extension configuration
// Detects environment and sets appropriate URLs

type Environment = 'development' | 'production';

interface Config {
  apiUrl: string;
  frontendUrl: string;
  environment: Environment;
}

// Check if we're in development mode
// This is a simple check - we'll use localhost URLs in development
function detectEnvironment(): Environment {
  // For Chrome extensions, we can use the chrome.runtime.getManifest().version
  // to determine if we're in development or production
  // If version contains 'dev', we're in development mode
  
  // During development, you can manually set this to true
  // This will be replaced with false during production builds
  const isDevelopment = true; // This should be set to false in production builds
  
  return isDevelopment ? 'development' : 'production';
}

const environment = detectEnvironment();
const isDevelopment = environment === 'development';

// Configure URLs based on environment
const config: Config = {
  environment,
  apiUrl: isDevelopment 
    ? 'http://localhost:3001'  // Local development API
    : 'https://bookmark-x-production.up.railway.app',  // Production API
  
  frontendUrl: isDevelopment
    ? 'http://localhost:3000'  // Local development frontend (Vite default)
    : 'https://bookmark-x.info',  // Production frontend
};

console.log(`Bookmark-X: Running in ${environment} mode`);
console.log(`Bookmark-X: API URL: ${config.apiUrl}`);
console.log(`Bookmark-X: Frontend URL: ${config.frontendUrl}`);
export default config;
