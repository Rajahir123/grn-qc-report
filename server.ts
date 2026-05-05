import express from "express";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// API Routes
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
  const baseUrl = region === "eu" ? "https://api.monday-eu.com/v2/" : "https://api.monday.com/v2/";

  token = token.trim();
  console.log(`[Proxy] Request to Monday API (${region})`);

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
    
    // Detailed error for 404/NOT_FOUND which is common for regional accounts
    if (status === 404 || (typeof errorData === "string" && (errorData.includes("<!DOCTYPE html>") || errorData.includes("NOT_FOUND")))) {
      return res.status(status).json({
        error: "Monday Gateway Error (404/NOT_FOUND). Your account might be in a specific region (like EU) or the API token does not have access to this endpoint.",
        status,
        details: typeof errorData === "string" ? errorData.substring(0, 300) : "Check if you need api.monday-eu.com",
      });
    }

    res.status(status).json(errorData || { error: "Failed to connect to Monday.com", details: error.message });
  }
});

// GET for debugging
app.get("/api/monday/proxy", (req, res) => {
  res.json({ status: "alive", message: "Monday proxy is ready" });
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
