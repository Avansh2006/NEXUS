# NEXUS — Production Deployment Guide (Netlify & Render)

This document provides complete instructions for deploying the **NEXUS** AI-Powered Criminal Network Analysis System to production using **Netlify** for the frontend and **Render** for the backend intelligence infrastructure.

---

## Architecture Overview

```
                          ┌────────────────────────┐
                          │   Netlify Edge CDN     │
                          │   (React 19 + Vite)    │
                          │   nexus.netlify.app    │
                          └──────────┬─────────────┘
                                     │
                    HTTPS API Calls / Reverse Proxy
                                     │
                                     ▼
                          ┌────────────────────────┐
                          │      Render Cloud      │
                          │   (Unified Service)    │
                          │  nexus-app.onrender.com│
                          ├────────────────────────┤
                          │  Spring Boot Backend   │
                          │     (Java 17, JRE)     │
                          │           │ (Loopback) │
                          │           ▼            │
                          │  Python Intel Engine   │
                          │  (FastAPI + spaCy +    │
                          │     NetworkX)          │
                          └──────────┬─────────────┘
                                     │
                                     ▼
                          ┌────────────────────────┐
                          │   Render PostgreSQL    │
                          │   (Managed Database)   │
                          └────────────────────────┘
```

---

## 1. Deploying the Backend to Render

### Option A: 1-Click Render Blueprint (Recommended)

NEXUS includes a `render.yaml` Blueprint specification that automatically provisions both the unified application service and the managed PostgreSQL database.

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your GitHub account and select repository `Avansh2006/NEXUS` (branch `first-agy` or `main`).
4. Render will read `render.yaml` and show:
   - **`nexus-db`**: PostgreSQL database (Free tier)
   - **`nexus-app`**: Unified Web Service (Docker runtime from root `Dockerfile`)
5. Click **Apply**.
6. Render will build the container, install spaCy/FastAPI, package the Spring Boot JAR, and start the service.
7. Once deployed, note down your Render Web Service URL:
   `https://<your-service-name>.onrender.com`

---

### Option B: Manual Web Service Setup on Render

If you prefer to create the service manually without Blueprints:

1. Click **New +** -> **Web Service**.
2. Select repository `Avansh2006/NEXUS` and branch `first-agy`.
3. Configure the service:
   - **Name**: `nexus-app`
   - **Region**: Oregon (or nearest)
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Free`
4. Add Environment Variables under **Advanced**:
   | Key | Value | Description |
   |---|---|---|
   | `PORT` | `10000` | Render port (auto-injected, default 10000) |
   | `FRONTEND_ORIGIN` | `*` | Or specify your Netlify URL |
   | `DEMO_DIR` | `/data/demo` | Demo synthetic data directory |
5. Click **Create Web Service**.
6. *(Optional)* To attach a persistent database:
   - Click **New +** -> **PostgreSQL**.
   - Copy the **Internal Database URL** and add it as `DATABASE_URL` in `nexus-app` environment variables.
   - *Note: If `DATABASE_URL` is omitted, NEXUS automatically falls back to an embedded in-memory H2 database in PostgreSQL compatibility mode.*

---

## 2. Deploying the Frontend to Netlify

### Option A: Netlify Dashboard (Git Integration)

1. Log in to [Netlify](https://app.netlify.com/).
2. Click **Add new site** -> **Import an existing project**.
3. Select **GitHub** and authorize access to `Avansh2006/NEXUS`.
4. Configure site settings:
   - **Branch to deploy**: `first-agy` (or `main`)
   - **Base directory**: `frontend`
   - **Build command**: `pnpm build`
   - **Publish directory**: `dist` (or `frontend/dist` if base is root)
5. Add Environment Variables:
   - `VITE_API_URL`: `https://<your-render-app>.onrender.com`
     *(e.g., `https://nexus-app.onrender.com`)*
6. Click **Deploy site**.

### Option B: Netlify CLI

If deploying from the terminal:

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Build frontend locally with Render API URL
cd frontend
export VITE_API_URL=https://<your-render-app>.onrender.com
corepack pnpm build

# 3. Deploy to Netlify production
netlify deploy --prod --dir=dist
```

---

## 3. Environment Variables Reference

### Backend (Render)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `10000` | Port for the public HTTP server (assigned by Render) |
| `DATABASE_URL` | *(none / embedded H2)* | PostgreSQL connection string (`postgres://...` or `jdbc:postgresql://...`) |
| `POSTGRES_USER` | `nexus` | PostgreSQL username (used if not in URL) |
| `POSTGRES_PASSWORD` | *(empty)* | PostgreSQL password (used if not in URL) |
| `INTELLIGENCE_URL` | `http://127.0.0.1:8000` | Address of the Python intelligence service |
| `DEMO_DIR` | `/data/demo` | Path to synthetic FIRs and CDR transactions |
| `FRONTEND_ORIGIN` | `*` | Allowed CORS origins (wildcard `*` or comma-separated URLs) |

### Frontend (Netlify)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | *(empty)* | Full URL of the Render backend (e.g. `https://nexus-app.onrender.com`). If empty, requests default to `/api/*` and use the Netlify proxy configured in `netlify.toml`. |

---

## 4. Verification & Smoke Test Checklist

Once both services are deployed:

1. **Verify Backend Health**:
   ```bash
   curl -I https://<your-render-app>.onrender.com/api/health
   # Expected: HTTP/2 200 OK
   ```

2. **Verify Reset / Seeding**:
   ```bash
   curl -X POST https://<your-render-app>.onrender.com/api/demo/reset -H "Content-Type: application/json" -d "{}"
   # Expected: {"nodes":..., "edges":..., "records":...}
   ```

3. **Verify Frontend UI**:
   - Open your Netlify URL: `https://<your-site>.netlify.app`
   - Observe the tactical dark theme HUD.
   - Click **Reset Demo Data** to populate the 21 nodes and 34 edges.
   - Verify 3D Globe renders with nodes mapped across districts.
   - Test "Stream FIR NXS-007" for live incremental ingestion.
   - Test "Export Investigation Report" for BSA 2023 court-admissible HTML dossier generation.
