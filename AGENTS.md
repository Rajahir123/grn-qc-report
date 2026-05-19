# Agent Working Protocol

This project belongs to **denyteny123@gmail.com**. When working on this repository, all AI agents or developers MUST follow these rules:

## 1. Approval Protocol
- **DO NOT** make architectural or major functional changes without explicit approval.
- **Before implementing any change:**
    1.  Explain exactly what you intend to do.
    2.  List the **PROS** (benefits) and **CONS** (risks/trade-offs) of the change in detail.
    3.  Ask for approval: "Would you like me to proceed with this update?"
    4.  Wait for the user's confirmation before modifying code.

## 2. Technical Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (v4).
- **Backend**: Express.js (dual support for local/AI Studio via `server.ts` and Vercel via `api/index.ts`).
- **Integration**: Monday.com API (Version 2024-04).
- **Multi-Region Support**: Supports both Global (`api.monday.com`) and Europe (`api.monday-eu.com`) endpoints.

## 3. Deployment Constraints
- The app is designed to be hosted on **Vercel**.
- The `vercel.json` and `api/index.ts` files are critical for Vercel deployment.
- Always ensure `cors` is enabled on the backend to prevent cross-origin issues during sync operations.
