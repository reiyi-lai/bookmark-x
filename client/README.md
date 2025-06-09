# Bookmark-X Client

This is the frontend React application for Bookmark-X, built with Vite and TypeScript.

## Development

To run the client in development mode:

```bash
npm run dev
```

This will start the development server on `http://localhost:3000`.

## Building

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment to Vercel

### Setup Instructions:

1. **Framework Preset**: Choose "Vite" as your framework preset
2. **Root Directory**: Select the `/client` directory as your root directory
3. **Build Settings** (should auto-detect):
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### Environment Configuration:

The application automatically detects the environment:
- **Development**: Uses `http://localhost:3000` for API calls
- **Production**: Uses `https://bookmark-x.info` for API calls

### Required Files:

All necessary configuration files are included:
- ✅ `package.json` - Dependencies and scripts
- ✅ `vite.config.ts` - Vite configuration
- ✅ `tsconfig.json` - TypeScript configuration
- ✅ `tailwind.config.js` - Tailwind CSS configuration
- ✅ `postcss.config.js` - PostCSS configuration
- ✅ `.gitignore` - Git ignore rules

### Static Assets:

- Icon files are in `/public/generated-icon.png` and will be served at `/generated-icon.png`
- All assets in the `public` directory are automatically copied to the build output

## Project Structure

```
client/
├── public/
│   └── generated-icon.png    # App icon
├── src/
│   ├── components/           # React components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Utility libraries
│   ├── pages/               # Page components
│   ├── utils/               # Utility functions
│   └── main.tsx            # Application entry point
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## Environment Variables

The app uses Vite's built-in environment detection:
- `import.meta.env.PROD` - True in production
- `import.meta.env.DEV` - True in development

API URLs are automatically configured based on the environment. 