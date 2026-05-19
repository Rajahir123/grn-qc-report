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
  const mToken = process.env.MONDAY_API_TOKEN;
  const aToken = process.env.Admin_API_Key || process.env.ADMIN_API_KEY;
  const envToken = (mToken && !mToken.includes("YOUR_")) ? mToken : (aToken && !aToken.includes("YOUR_") ? aToken : "");

  let token = (
    typeof headerToken === "string" && headerToken !== "" && !headerToken.includes("YOUR_") ? headerToken :
    (Array.isArray(headerToken) && headerToken[0] !== "" && !headerToken[0].includes("YOUR_") ? headerToken[0] :
    (envToken ? envToken : null))
  );

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ error: "Missing Monday API Token" });
  }

  const requestRegion = typeof headerRegion === "string" ? headerRegion : (process.env.MONDAY_REGION || "global");
  const region = requestRegion.toString().toLowerCase() === "eu" ? "eu" : "global";
  // Removed trailing slash as it can cause 405/404 on some API gateways
  const baseUrl = region === "eu" ? "https://api.monday-eu.com/v2" : "https://api.monday.com/v2";

  token = token.toString().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').replace(/[\r\n\s]+/g, '').trim();
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

    if (status === 401) {
      console.error("[Proxy] Monday API Error: 401 Unauthorized. The API token is invalid.", errorData);
    }
    
    let responseBody = errorData;
    if (typeof errorData === "string") {
      responseBody = { error: errorData };
    } else if (!errorData || typeof errorData !== "object") {
      responseBody = { error: "Unknown error from Monday API", raw: errorData };
    }
    
    // Pass back as much info as possible for debugging
    res.status(status).json({ 
      ...responseBody,
      proxy_status: status, 
      proxy_details: error.message,
      debug_region: region,
      debug_tokenLength: token?.length,
      debug_tokenPreview: token ? token.substring(0, 5) + '...' : 'none'
    });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  
  const mToken = process.env.MONDAY_API_TOKEN;
  const aToken = process.env.Admin_API_Key || process.env.ADMIN_API_KEY;
  const envToken = (mToken && !mToken.includes("YOUR_")) ? mToken : (aToken && !aToken.includes("YOUR_") ? aToken : "");
  const targetBoard = process.env.Target_Board_ID || process.env.TARGET_BOARD_ID || "";
  
  if (password === "1522") {
    return res.json({
      success: true,
      mondayToken: envToken.toString().replace(/^["']|["']$/g, '').trim(),
      boardId: targetBoard.includes("YOUR_") ? "" : targetBoard.toString().replace(/^["']|["']$/g, '').trim(),
      region: (process.env.MONDAY_REGION || "global").toString().replace(/^["']|["']$/g, '').toLowerCase().trim()
    });
  }
  
  res.status(401).json({ error: "Invalid password" });
});

app.get("/api/monday/proxy", (req, res) => {
  console.log("[Proxy] GET /api/monday/proxy ping received");
  const mToken = process.env.MONDAY_API_TOKEN || "";
  const aToken = process.env.Admin_API_Key || process.env.ADMIN_API_KEY || "";
  const hasValidToken = (mToken && !mToken.includes("YOUR_")) || (aToken && !aToken.includes("YOUR_"));
  res.json({ 
    status: "alive", 
    message: "Monday proxy is ready",
    env: process.env.NODE_ENV,
    hasToken: !!hasValidToken
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
