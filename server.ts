import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/monday/proxy", async (req, res) => {
    const headerToken = req.headers['x-monday-token'];
    const envToken = process.env.MONDAY_API_TOKEN;
    
    // Prioritize the token from the UI
    let token = (typeof headerToken === 'string' ? headerToken : 
                  (Array.isArray(headerToken) ? headerToken[0] : 
                  (envToken && !envToken.includes('YOUR_') ? envToken : null)));
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: "Missing Monday API Token. Please provide it in the UI." });
    }

    token = token.trim();

    try {
      const response = await axios.post("https://api.monday.com/v2", req.body, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token,
          "API-Version": "2024-04"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("Monday API Proxy Error:", {
        status: error.response?.status,
        data: errorData,
        message: error.message
      });
      res.status(error.response?.status || 500).json(errorData || { error: "Failed to connect to Monday.com" });
    }
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
