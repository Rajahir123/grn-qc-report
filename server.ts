import express from "express";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// API Routes
/**
 * GOOGLE SHEETS EXPORT ENDPOINT
 * 
 * Bridges data to Google Apps Script webhooks.
 */
app.post("/api/export/gsheet", async (req, res) => {
  const { url, data } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing G-Sheet Webhook URL" });
  }

  try {
    console.log(`[Export] Sending data to G-Sheet Webhook: ${url.substring(0, 40)}...`);
    const response = await axios.post(url, data, {
      headers: { "Content-Type": "application/json" },
      maxRedirects: 5,
    });
    res.json({ success: true, details: response.data });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    console.error(`[Export] G-Sheet Error (${status}):`, error.message);
    res.status(status).json({ error: "Failed to export to Google Sheets", details: error.message });
  }
});

/**
 * MONDAY.COM PROXY ENDPOINT
 * 
 * Proxies GraphQL requests to Monday.com to handle CORS and auth securely.
 * Supports Regional endpoints (EU vs Global).
 */
app.post("/api/monday/proxy", async (req, res) => {
  const headerToken = req.headers["x-monday-token"];
  const headerRegion = req.headers["x-monday-region"];
  const envToken = process.env.MONDAY_API_TOKEN;

  let token = (
    typeof headerToken === "string" ? headerToken :
    (Array.isArray(headerToken) ? headerToken[0] :
    (envToken && !envToken.includes("YOUR_") ? envToken : null))
  );

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ error: "Missing Monday API Token" });
  }

  const region = typeof headerRegion === "string" ? headerRegion : "global";
  const baseUrl = region === "eu" ? "https://api.monday-eu.com/v2" : "https://api.monday.com/v2";

  token = token.trim();
  console.log(`[Proxy] Incoming POST to /api/monday/proxy (Region: ${region})`);
  
  if (!req.body || typeof req.body !== "object") {
    console.warn("[Proxy] Missing or invalid body in POST request");
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const response = await axios.post(baseUrl, req.body, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
        "API-Version": "2024-04",
      },
    });
    res.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorData = error.response?.data;

    console.error(`[Proxy] Monday API Error (${status})`);
    
    if (status === 404 || (typeof errorData === "string" && (errorData.includes("<!DOCTYPE html>") || errorData.includes("NOT_FOUND")))) {
      return res.status(status).json({
        error: "Monday Gateway Error (404/NOT_FOUND). Check token/region.",
        status,
        details: typeof errorData === "string" ? errorData.substring(0, 300) : "Check regional endpoint"
      });
    }

    if (status === 500) {
      console.error("[Proxy] 500 Internal Server Error details:", {
        message: error.message,
        data: errorData,
        requestId: error.response?.headers?.["x-request-id"],
        payload: req.body
      });
    }

    res.status(status).json(errorData || { error: "Failed to connect to Monday.com", details: error.message });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  
  if (password === "1522") {
    return res.json({
      success: true,
      mondayToken: process.env.MONDAY_API_TOKEN || process.env.Admin_API_Key || "",
      boardId: process.env.Target_Board_ID || process.env.TARGET_BOARD_ID || ""
    });
  }
  
  res.status(401).json({ error: "Invalid password" });
});

// GET for debugging
app.get("/api/monday/proxy", (req, res) => {
  console.log("[Proxy] GET /api/monday/proxy ping received");
  res.json({ 
    status: "alive", 
    message: "Monday proxy is ready",
    env: process.env.NODE_ENV,
    hasToken: !!process.env.MONDAY_API_TOKEN
  });
});

// Explicitly handle 404 for missing API routes
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // In development, Vite middleware will be added by the dev server runner
}

// Development server startup
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  // We dynamic import here to avoid runtime issues in serverless
  if (process.env.NODE_ENV !== "production") {
    import("vite").then(({ createServer }) => {
      createServer({
        server: { middlewareMode: true },
        appType: "spa",
      }).then((vite) => {
        app.use(vite.middlewares);
        app.listen(Number(PORT), "0.0.0.0", () => {
          console.log(`Development server running at http://localhost:${PORT}`);
        });
      });
    });
  } else {
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Production server running at http://localhost:${PORT}`);
    });
  }
}

export default app;
