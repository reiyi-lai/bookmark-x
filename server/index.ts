import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that might use them
console.log('🔧 Loading environment variables...');
dotenv.config();
console.log('🔧 Railway Debug - NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 Railway Debug - PORT:', process.env.PORT);
console.log('🔧 Railway Debug - SUPABASE vars present:', !!process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('🔧 Environment Debug - SUPABASE_URL present:', !!process.env.SUPABASE_URL);
console.log('🔧 SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import cors from 'cors';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Enable CORS with proper configuration for credentials
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',     // Server itself (for internal requests)
      'http://localhost:3001',     // Frontend dev server
      'https://bookmark-x.info',   // Production frontend
      'https://wwww.bookmark-x.info',
      'chrome-extension://*'       // Chrome extension (wildcard)
    ];
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.endsWith('*')) {
        // Handle wildcard patterns like 'chrome-extension://*'
        return origin.startsWith(allowedOrigin.slice(0, -1));
      }
      return origin === allowedOrigin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-twitter-id']
};
app.use(cors(corsOptions));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('🚀 Starting server setup...');
  const server = await registerRoutes(app);
  console.log('✅ Routes registered successfully');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    console.log('Setting up Vite for development...');
    await setupVite(app, server);
  } else {
    console.log('Production: Railway serves API only, Vercel serves frontend');
    // No static serving needed - Railway is API-only
  }

  // Use Railway's PORT environment variable or fallback to 3000
  const port = process.env.PORT || 3000;
  console.log(`Starting server on port ${port}...`);
  server.listen(port, () => {
    log(`serving on port ${port}`);
    console.log(`✅ Server successfully started on port ${port}`);
  });
})();