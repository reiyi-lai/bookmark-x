// To indicate dev or prod for chrome-extension
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'src', 'config.ts');
let configContent = fs.readFileSync(configPath, 'utf8');
configContent = configContent.replace(
  'const isDevelopment = true;',
  'const isDevelopment = false;'
);
fs.writeFileSync(configPath, configContent);

console.log('Updated config.ts for production build');
