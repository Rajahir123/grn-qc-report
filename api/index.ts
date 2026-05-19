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
 * Sends QC data to a Google Apps Script webhook for reporting.
 * 
 * @body { url: string, data: object }
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
 * This endpoint handles communication with the Monday.com API.
 * It support multi-region accounts (Global vs EU).
 * 
 * @header x-monday-token - The personal API token
 * @header x-monday-region - 'global' or 'eu'
 * @body { query: string, variables: object } - GraphQL payload
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
  // Removed trailing slash as it can cause 405/404 on some API gateways
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

app.get("/api/monday/proxy", (req, res) => {
  console.log("[Proxy] GET /api/monday/proxy ping received");
  res.json({ 
    status: "alive", 
    message: "Monday proxy is ready",
    env: process.env.NODE_ENV,
    hasToken: !!process.env.MONDAY_API_TOKEN
  });
});

app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// For Vercel, we need to export the app but also handle static serving if requested
// However, rewrites in vercel.json usually handle the SPA fallback.
// We don't start the listener here for Vercel.

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
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
