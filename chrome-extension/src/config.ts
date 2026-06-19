type Environment = 'development' | 'production';

interface Config {
  apiUrl: string;
  frontendUrl: string;
  environment: Environment;
}

function detectEnvironment(): Environment {
  const isDevelopment = false; // BUILD_FLAG
  return isDevelopment ? 'development' : 'production';
}

const environment = detectEnvironment();
const isDevelopment = environment === 'development';

const config: Config = {
  environment,
  apiUrl: isDevelopment 
    ? 'http://localhost:3001'  // Local development API
    : 'https://bookmark-x-production.up.railway.app',  // Production API
  
  frontendUrl: isDevelopment
    ? 'http://localhost:3000/app'  // Local development frontend (Vite default)
    : 'https://bookmark-x.info/app',  // Production frontend
};

console.log(`Bookmark-X: Running in ${environment} mode`);
console.log(`Bookmark-X: API URL: ${config.apiUrl}`);
console.log(`Bookmark-X: Frontend URL: ${config.frontendUrl}`);
export default config;
