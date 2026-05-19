# 🛠️ Developer Manifesto: Monday Board Connect

This document is a technical post-mortem and developer guide for the **Monday Board Connect (QC Sync)** application. It outlines how the app was built from scratch, the design decisions made, and the prompts used to generate the logic.

---

## 🏗️ The Build Flow (Mental Model)

The app was built using a **Modular Iteration** approach:

1.  **UI Skeleton**: Initialized the dashboard with a "Brutalist" design aesthetic (heavy borders, high contrast).
2.  **API Bridge**: Built a Node.js Express proxy to solve two problems: **CORS limitations** and **Security of API Secrets**.
3.  **Authentication Layer**: Implemented a dynamic token system where users enter their Personal API token once, which is then stored in local storage for subsequent sessions.
4.  **Sync Logic**: Developed a two-stage GraphQL mutation (Create Item -> Update Columns) to handle the complex structure of Monday.com items.
5.  **Multi-Region Support**: Added a region-aware routing system to toggle between `.monday.com` and `.monday-eu.com` gateways.
6.  **Vercel Optimization**: Created a dedicated `api/index.ts` to support Vercel's Serverless Function architectural needs.

---

## 📜 Developer Prompts (Chronological History)

Here are the core prompts used to instruct the AI during development:

1.  **Initialization**: *"Create a React 19 app with Vite and Tailwind v4. The design should be brutalist (black/white, thick borders). I need a dashboard to manage Quality Control reports."*
2.  **Monday Integration**: *"Implement a proxy server in express to handle Monday.com GraphQL requests. Use headers for the API token. Support global and EU regions."*
3.  **Data Schema**: *"Create a QC Report builder UI that captures QC No, Party Name, and State. Sync these to a Monday.com board using mutations."*
4.  **Vercel Deployment**: *"Build a vercel.json and a standalone serverless function in /api/index.ts that mirrors the logic in server.ts but is optimized for cloud hosting."*
5.  **Security Protocol**: *"Create an AGENTS.md file that mandates an 'Approval Protocol' before any major changes. AI must provide Pros and Cons for every update."*

---

## 🧩 Component Breakdown

### 1. The Proxy (Backend)
-   **File**: `api/index.ts` & `server.ts`
-   **Logic**: Uses `axios` to relay POST requests. It strips problematic trailing slashes and dynamically sets the `Authorization` and `API-Version` headers.

### 2. The Context Provider (State Manager)
-   **File**: `src/App.tsx` -> `MondayProvider`
-   **Logic**: Wraps the app in a logic layer that refreshes Monday Board data every time the API token or Region changes.

### 3. The Sync Engine
-   **Function**: `submitReport`
-   **Logic**: 
    - `Mutation 1`: Creates the item with just the name. 
    - `Mutation 2`: Stringifies a JSON object of column values (using Monday's `change_multiple_column_values` API) and applies them to the newly created ID.

---

## 🚀 Guidelines for Future Developers

-   **Adding Columns**: To sync a new piece of data, you must add it to the `QCReport` interface in `App.tsx` and then update the GraphQL JSON payload in the `change_multiple_column_values` mutation.
-   **Regional Gateway**: If you get a 404, check the headers on the proxy. The `x-monday-region` header must be correctly set to `eu` to talk to the European servers.
-   **Local Development**: Run the app using `tsx server.ts` to ensure the proxy and frontend run on the same port (3000).

---
*Documentation Version: 2.0.0*
*For: denyteny123@gmail.com*

