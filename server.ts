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
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[Server] ${req.method} ${req.url}`);
    }
    next();
  });

  app.post("/api/export/gsheet", async (req, res) => {
    const { url, data } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "Missing G-Sheet Webhook URL" });
    }

    try {
      console.log(`[Export] Sending data to G-Sheet Webhook: ${url.substring(0, 40)}...`);
      const response = await axios.post(url, data, {
        headers: {
          "Content-Type": "application/json"
        },
        maxRedirects: 5
      });
      console.log(`[Export] G-Sheet Success:`, response.status);
      res.json({ success: true, details: response.data });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data;
      
      console.error(`[Export] G-Sheet Error (${status}):`, error.message);
      if (errorData) console.error(`[Export] Error details:`, typeof errorData === 'string' ? errorData.substring(0, 500) : errorData);

      let message = "Failed to export to Google Sheets";
      if (status === 401 || status === 403) {
        message = "G-Sheet Access Denied (401/403). Ensure your Web App is deployed with 'Access: Anyone'.";
      } else if (status === 404) {
        message = "G-Sheet Webhook URL not found (404). Check your URL.";
      }

      res.status(status).json({ 
        error: message, 
        details: error.message,
        status 
      });
    }
  });

  app.post("/api/monday/proxy", async (req, res) => {
    const headerToken = req.headers['x-monday-token'];
    const envToken = process.env.MONDAY_API_TOKEN;
    
    let token = (typeof headerToken === 'string' ? headerToken : 
                  (Array.isArray(headerToken) ? headerToken[0] : 
                  (envToken && !envToken.includes('YOUR_') ? envToken : null)));
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: "Missing Monday API Token" });
    }

    token = token.trim();
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.substring(7).trim();
    }
    
    const maskedToken = `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
    
    // Select the best endpoint. Monday API endpoints DO NOT usually want a trailing slash.
    const endpoints = [
      "https://api.monday.com/v2",
      "https://api.eu.monday.com/v2",
      "https://api.monday.com/v2/graphql" // Another potential variation
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[Proxy] Attempting Monday API at ${endpoint} with token ${maskedToken}`);
        const response = await axios.post(endpoint, req.body, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": token,
            "x-monday-api-key": token,
            "API-Version": "2024-04" 
          },
          timeout: 12000 
        });

        // Some Monday errors come back as 200 but with an "errors" array
        if (response.data && response.data.errors) {
          console.warn("[Proxy] Monday returned 200 but with errors:", response.data.errors[0].message);
        }

        return res.json(response.data);
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        
        console.warn(`[Proxy] Error at ${endpoint}: Status ${status}`);

        // If it's a 404, we might be hitting the wrong region gateway. Try the next.
        if (status === 404 && endpoint !== endpoints[endpoints.length - 1]) {
          continue;
        }

        break;
      }
    }

    const status = lastError.response?.status || 500;
    const errorData = lastError.response?.data;
    const failedUrl = lastError.config?.url || "unknown";
    
    // RETURN JSON with the status code from Monday (or 500)
    let detailedMsg = typeof errorData === 'string' ? errorData.substring(0, 1000) : JSON.stringify(errorData || "No details").substring(0, 500);
    if (detailedMsg.includes("<!DOCTYPE html>")) {
      detailedMsg = "Received HTML response instead of JSON. This often means the Monday.com API URL used in server.ts is incorrect for your region or the token is definitely invalid.";
    }

    console.error(`[Proxy] Final failure for all endpoints. Status: ${status}, Message: ${lastError.message}`);

    res.status(status).json({ 
      proxy_error: true,
      status: status,
      error: `Monday API failure`,
      details: detailedMsg,
      message: lastError.message
    });
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
