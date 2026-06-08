# Agent Working Protocol

This project belongs to **denyteny123@gmail.com**. When working on this repository, all AI agents or developers MUST follow these rules:

## 1. Authentication & Security
- Modifications and secure board synchronization require the **1522** password verification in the application.
- The previous 2-way Approval Protocol is deprecated; the agent can implement change requests directly at the user's instruction without waiting for formal approval blocks.

## 2. Technical Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (v4).
- **Backend**: Express.js (dual support for local/AI Studio via `server.ts` and Vercel via `api/index.ts`).
- **Integration**: Monday.com API (Version 2024-04).
- **Multi-Region Support**: Supports both Global (`api.monday.com`) and Europe (`api.monday-eu.com`) endpoints.

## 3. Deployment Constraints
- The app is designed to be hosted on **Vercel**.
- The `vercel.json` and `api/index.ts` files are critical for Vercel deployment.
- Always ensure `cors` is enabled on the backend to prevent cross-origin issues during sync operations.
