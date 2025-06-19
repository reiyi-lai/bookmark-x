// To indicate dev or prod for chrome-extension
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'src', 'config.ts');
let configContent = fs.readFileSync(configPath, 'utf8');
configContent = configContent.replace(
  'const isDevelopment = true;',
  'const isDevelopment = false;'
);
fs.writeFileSync(configPath, configContent);

console.log('Updated config.ts for production build');
