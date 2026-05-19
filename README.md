# Monday Board Connect (QC Sync)

A production-grade tool for syncing Quality Control reports to Monday.com boards with multi-region support and Google Sheets export capabilities.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or higher)
- npm or yarn

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 📦 Deployment

### Deploy to Vercel
This project is pre-configured for Vercel. Simply connect your GitHub repository to Vercel, and it will automatically detect the settings.

### Key Files
- `server.ts`: Local development server.
- `api/index.ts`: Vercel serverless function entry.
- `vercel.json`: Vercel routing configuration.

## 🛡️ Security
- **API Proxy**: All requests to Monday.com are proxied to hide tokens and avoid CORS issues.
- **Multi-Region**: Supports EU and Global Monday.com accounts.

## 📜 License
Private - Created for denyteny123@gmail.com
