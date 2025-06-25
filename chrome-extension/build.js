import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildMode = process.argv[2] || 'prod';
const isDev = buildMode === 'dev';

// Update config.ts directly with string replacement
const configPath = path.join(__dirname, 'src', 'config.ts');
const fileContent = fs.readFileSync(configPath, 'utf8');
const newContent = fileContent.replace(
  'const isDevelopment = true; // BUILD_FLAG',
  `const isDevelopment = ${isDev}; // BUILD_FLAG`
).replace(
  'const isDevelopment = false; // BUILD_FLAG',
  `const isDevelopment = ${isDev}; // BUILD_FLAG`
);

fs.writeFileSync(configPath, newContent);
console.log(`Updated config.ts: isDevelopment = ${isDev}`);
