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
    const maskedToken = `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
    
    // Select the best endpoint. Start with global.
    const endpoints = [
      "https://api.monday.com/v2/",
      "https://api.eu.monday.com/v2/"
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[Proxy] Attempting Monday API at ${endpoint} with token ${maskedToken}`);
        const response = await axios.post(endpoint, req.body, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": token,
            "API-Version": "2024-10" // Updated to latest stable
          },
          timeout: 10000 // 10s timeout
        });

        // If we get here, it worked. Return it.
        return res.json(response.data);
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        
        // If it's a 404, we might be hitting the wrong region. Try the next endpoint.
        if (status === 404 && endpoint !== endpoints[endpoints.length - 1]) {
          console.warn(`[Proxy] 404 at ${endpoint}. Retrying with next endpoint...`);
          continue;
        }

        // If it's not a 404 or we're at the last endpoint, handle the error
        break;
      }
    }

    // Handle errors from the last attempt (or the one that broke the loop)
    const status = lastError.response?.status || 500;
    const errorData = lastError.response?.data;
    
    console.error(`[Proxy] Monday API Final Error (${status})`);

    // Ensure we always return JSON
    if (typeof errorData === 'string' && (errorData.includes('<!DOCTYPE html>') || errorData.includes('NOT_FOUND') || errorData.includes('The page could not be found'))) {
      return res.status(status).json({ 
        error: "Monday Gateway Error (404/NOT_FOUND). Your account might be in a specific region or the API token is invalid for this URL.", 
        status,
        details: errorData.substring(0, 300) 
      });
    }

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: `Monday Authentication Error (${status}): ${errorData?.error_message || "Invalid or insufficient API token permissions."}`,
        status,
        details: "Check your API token. Use the Personal Token from Administration > API. Also ensure the token has 'Workspaces', 'Boards:Read', and 'Boards:Write' scopes.",
        raw: errorData
      });
    }

    res.status(status).json(errorData && typeof errorData === 'object' ? errorData : { 
      error: lastError.message || "Failed to connect to Monday.com",
      details: typeof errorData === 'string' ? errorData.substring(0, 500) : null
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
