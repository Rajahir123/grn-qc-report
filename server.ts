import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  // API Routes
  app.post("/api/monday/proxy", async (req, res) => {
    console.log(`[Proxy] Incoming POST request for Monday API`);
    const headerToken = req.headers['x-monday-token'];
    const envToken = process.env.MONDAY_API_TOKEN;
    
    let token = (typeof headerToken === 'string' ? headerToken : 
                  (Array.isArray(headerToken) ? headerToken[0] : 
                  (envToken && !envToken.includes('YOUR_') ? envToken : null)));
    
    if (!token || token === 'null' || token === 'undefined') {
      console.warn(`[Proxy] Request rejected: Missing token`);
      return res.status(401).json({ error: "Missing Monday API Token" });
    }

    token = token.trim();

    try {
      console.log(`[Proxy] Forwarding to Monday API...`);
      const response = await axios.post("https://api.monday.com/v2", req.body, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token,
          "API-Version": "2024-04"
        },
        timeout: 10000 // 10s timeout
      });
      console.log(`[Proxy] Monday API Success (Status: ${response.status})`);
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data;
      
      console.error(`[Proxy] Monday API Error (${status}):`, {
        data: typeof errorData === 'string' ? errorData.substring(0, 200) : errorData,
        message: error.message,
        url: error.config?.url
      });

      // Always return JSON even if Monday returns HTML
      if (typeof errorData === 'string' && (errorData.includes('<!DOCTYPE html>') || errorData.includes('NOT_FOUND'))) {
        return res.status(status).json({ 
          error: "Monday API returned an HTML/Text error page", 
          status,
          details: errorData.substring(0, 300) 
        });
      }

      res.status(status).json(errorData || { error: "Failed to connect to Monday.com" });
    }
  });

  // Add a GET for debugging
  app.get("/api/monday/proxy", (req, res) => {
    res.json({ message: "Proxy endpoint is alive. Use POST to communicate with Monday API." });
  });

  // Explicitly handle 404 for API routes to avoid falling through to SPA HTML
  app.all("/api/*", (req, res) => {
    console.warn(`[Proxy] 404 for ${req.method} ${req.url}`);
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
