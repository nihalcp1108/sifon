# Sifon — Production-Ready Stock Management Web Application

Sifon is an enterprise-grade stock management and warehouse inventory system built on the MERN stack (MongoDB, Express, React, Node.js) with TypeScript. It enforces immutable ledger tracking, atomic inventory transactions, segregated damaged goods accounting, and audit-grade stock statements.

---

## Table of Contents

1. [Architectural Overview & Core Inventory Rules](#architectural-overview--core-inventory-rules)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup: Local Replica Set & MongoDB Atlas](#database-setup-local-replica-set--mongodb-atlas)
6. [Installation & Setup](#installation--setup)
7. [Admin User Creation](#admin-user-creation)
8. [Development & Seeding](#development--seeding)
9. [Running Automated Tests](#running-automated-tests)
10. [Inventory Reconciliation Audit](#inventory-reconciliation-audit)
11. [Production Build & Deployment](#production-build--deployment)
12. [API Reference & Collection](#api-reference--collection)
13. [SPA Refresh Routing & Production Considerations](#spa-refresh-routing--production-considerations)
14. [Backup Recommendations](#backup-recommendations)
15. [Known Limitations](#known-limitations)

---

## Architectural Overview & Core Inventory Rules

Sifon is strictly an inventory and stock control system (not an e-commerce store or accounting software). All stock quantities are represented as positive whole integers.

### 1. Immutable Ledger + Materialized Balances
- **`InventoryMovement`**: Append-only ledger recording every stock movement with signed deltas (`availableDelta`, `damagedDelta`), movement type, business date, source document ID/line, user ID, and reason.
- **`InventoryBalance`**: Materialized read cache storing `availableQuantity` and `damagedQuantity` per product and area, guarded by compound unique index `{ productId: 1, areaId: 1 }`.
- **Atomic Balance Updates**: Every balance deduction uses guarded updates:
  ```ts
  InventoryBalance.findOneAndUpdate(
    { productId, areaId, availableQuantity: { $gte: requiredQuantity } },
    { $inc: { availableQuantity: -requiredQuantity } },
    { session, new: true }
  )
  ```
  If available balance is insufficient, the update returns null, throwing `400 Bad Request` and rolling back the entire multi-document transaction.

### 2. Numbered Areas
- Areas are represented strictly by numeric identifiers: **Area 1, Area 2, Area 3...**
- Naturally sorted numerically: `1, 2, 3, 10` (never alphabetical `1, 10, 2`).
- Deactivation is blocked if any available or damaged stock remains in the area.
- Hard-deletion is blocked if the area has historical inventory ledger records.

### 3. Products
- Product codes / SKUs are unique and uppercase.
- Products do **not** store a mutable "stock" field.
- Opening stock on product creation generates `OPENING_STOCK` ledger movements. Once created, balances cannot be modified via product edits.
- Archived products remain accessible in historical reports. New purchases and sales are blocked for archived products, but customer returns against existing sales remain permitted.

### 4. Purchases
- Multi-line purchases received into designated areas.
- Status: `DRAFT`, `POSTED`, `CANCELLED`.
- Drafts can be edited or deleted.
- Posted purchases atomically increment `availableQuantity` in receiving areas.
- Controlled cancellation/reversal creates compensating `PURCHASE_REVERSAL` movements with required reason. Reversal is rejected if deducting stock would make the area balance negative.

### 5. Sales
- Multi-line sales from designated source areas.
- Status: `DRAFT`, `POSTED`, `CANCELLED`.
- Posted sales atomically deduct `availableQuantity` from exact source areas.
- Race conditions and overselling are strictly prevented via guarded atomic decrements in MongoDB replica set transactions.
- **Sale Reversal Guard**: A sale cannot be cancelled or reversed if active customer returns exist against it. Those returns must be reversed first.

### 6. Customer Sales Returns
- Returns link directly to an original sale and line item.
- Supports partial returns and multiple returns up to `soldQuantity - previousActiveReturns`.
- **Non-Damaged Quantity**: Increases `availableQuantity` in the receiving area (defaults to original sale area, or chosen active area).
- **Damaged Quantity**: Increases `damagedQuantity` in the receiving area only. **Never reduces available stock again** (the unit already left available stock when sold).
- **Damaged Inventory Segregation**: Damaged units never count as available or saleable stock.
- Reversal of a return requires a reason and checks that area balances are sufficient before rolling back.

### 7. Timezone & Backdating
- Business Timezone: **`Asia/Kolkata`** (UTC +05:30).
- Timestamps stored in UTC. Date boundaries for reports and filters apply start-of-day inclusive and end-of-day exclusive boundaries in `Asia/Kolkata`.

### 8. Idempotency
- Mutating operations accept `X-Idempotency-Key`.
- Replaying the same key with identical payload returns the cached result without executing stock movements twice (`X-Cache-Lookup: IDEMPOTENT-HIT`).
- Reusing a key with a different payload is rejected with `409 Conflict`.

---

## Project Structure

```
sifon/
├── backend/
│   ├── src/
│   │   ├── config/             # Environment, Database configuration
│   │   ├── middleware/         # Auth, CSRF, Rate Limiting, Idempotency, Validation, Error Handling
│   │   ├── modules/
│   │   │   ├── auth/           # Login, JWT cookies, User model
│   │   │   ├── areas/          # Numbered Areas (Area 1..N)
│   │   │   ├── products/       # Products & opening stock
│   │   │   ├── purchases/      # Multi-line purchase receipts
│   │   │   ├── sales/          # Multi-line sales & oversell protection
│   │   │   ├── returns/        # Customer returns (non-damaged & damaged)
│   │   │   ├── damaged/        # Damaged inventory tracking & origin history
│   │   │   ├── inventory/      # Ledger, materialized balances, idempotency
│   │   │   ├── reports/        # Stock Matrix & Period Movement statements
│   │   │   ├── dashboard/      # Unit KPIs & recent transactions
│   │   │   └── audit/          # Audit logging
│   │   ├── utils/              # CSV injection defense, Timezone dates, Mongo transactions
│   │   ├── app.ts              # Express application factory
│   │   └── server.ts           # HTTP server startup & graceful shutdown
│   ├── scripts/
│   │   ├── create-admin.ts     # CLI admin creation tool
│   │   ├── seed.ts             # Development demo seed script
│   │   ├── reconcile.ts        # Read-only ledger vs balance auditor
│   │   └── start-local-mongo.ts# Local in-memory replica set runner
│   ├── tests/
│   │   ├── acceptance.test.ts  # 10-step Final Acceptance Scenario
│   │   ├── business-rules.test.ts # Concurrency, guards, oversell tests
│   │   └── reconciliation.test.ts # Mathematical balance integrity tests
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                # App entry & React Router routes
│   │   ├── components/
│   │   │   ├── common/         # Button, Input, Select, Badge, Modal, ConfirmDialog, etc.
│   │   │   └── layout/         # Sidebar, Topbar, PageHeader, AppLayout
│   │   ├── features/
│   │   │   ├── auth/           # Login screen & useAuth hook
│   │   │   ├── dashboard/      # KPI stat cards & recent movements
│   │   │   ├── areas/          # Numbered areas management
│   │   │   ├── products/       # Catalog & movement history
│   │   │   ├── purchases/      # Purchase creation, drafts & details
│   │   │   ├── sales/          # Sales orders & real-time stock indicator
│   │   │   ├── returns/        # Customer returns with validation
│   │   │   ├── damaged/        # Damaged goods quarantine
│   │   │   └── reports/        # Area Matrix & Period Movement Statements
│   │   ├── lib/                # Centralized Axios client, date formatters
│   │   ├── types/              # Full TypeScript interfaces
│   │   ├── index.css           # Tailwind CSS styles & print rules
│   │   └── main.tsx            # React DOM bootstrap
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .env.example
├── package.json                # Root orchestration scripts
├── README.md
└── .gitignore
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended, tested on Node v26)
- **npm**: v9.0.0 or higher
- **MongoDB**: Replica set instance (Atlas or local replica set with `wiredTiger`).

---

## Environment Configuration

Sifon uses separate environment files for the backend service and the frontend web application.

### File Locations

| Component | Active Environment File | Template / Example File |
| :--- | :--- | :--- |
| **Backend** | `backend/.env` | `backend/.env.example` |
| **Frontend** | `frontend/.env` | `frontend/.env.example` |

> [!IMPORTANT]
> - Never commit real `.env` files or secret values to version control. Both `backend/.env` and `frontend/.env` are ignored by `.gitignore`.
> - Always restart the backend server and the Vite development server whenever you modify `.env` files.
> - **Vite Public Variables**: All `VITE_*` variables are statically embedded into client-side JavaScript bundles at **build time**. Changing `.env` in production requires rebuilding the frontend (`npm --prefix frontend run build`). Never put private secrets, database URIs, or signing keys in frontend environment files.

---

### Backend Environment Variables (`backend/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `5000` | Port on which the Express backend HTTP server listens. |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `production`, or `test`). Sets cookie security flags and logging verbosity. |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<USER>:<PASS>@<HOST>/sifon?retryWrites=true&w=majority` | Canonical MongoDB connection string. Must point to a replica set (Atlas cluster or local replica set) to support multi-document ACID transactions. Localhost fallback is disabled. |
| `JWT_SECRET` | **Yes** | 64-char random hex | Cryptographic secret used to sign and verify JSON Web Tokens (min 32 characters). Generated automatically if missing during setup. |
| `JWT_EXPIRES_IN`| No | `7d` | Session token lifetime (e.g., `7d`, `24h`, `1d`). |
| `COOKIE_SECRET` | **Yes** | 64-char random hex | Secret used to sign HttpOnly session cookies for tamper detection. |
| `FRONTEND_URL` | No | `http://localhost:5173` | Explicit frontend origin for CORS allowlist and credentialed requests (`withCredentials: true`). Supports comma-separated origins for staging/production (e.g., `http://localhost:5173,https://app.sifon.com`). Wildcards are prohibited with credentials. |
| `TIMEZONE` | No | `Asia/Kolkata` | Business timezone used for ledger date boundaries and day-end reporting. |
| `INITIAL_ADMIN_EMAIL` | No | `admin@sifon.local` | Default email for seeding the initial admin via `npm run create-admin`. |
| `INITIAL_ADMIN_PASSWORD` | No | `Admin@Sifon2026!` | Default password for initial admin creation. Change immediately in production. |
| `INITIAL_ADMIN_NAME` | No | `Super Admin` | Display name for the initial admin account. |

---

### Frontend Environment Variables (`frontend/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `http://localhost:5000/api/v1` | Canonical public URL of the backend API prefix. Must match backend port and `/api/v1` route prefix. The centralized API client automatically normalizes trailing slashes and avoids duplicate prefixes. |
| `VITE_API_BASE_URL` | No | `http://localhost:5000/api/v1` | Backwards-compatible alias for `VITE_API_URL`. |
| `VITE_APP_NAME` | No | `Sifon` | Application title rendered in navigation headers and browser documents. |

---

## Database Setup: Local Replica Set & MongoDB Atlas

MongoDB multi-document transactions require a replica set (`wiredTiger` engine).

### Option A: MongoDB Atlas (Recommended for Cloud & Production)

Follow these steps to configure your MongoDB Atlas cluster:

1. **Create an Atlas Cluster**:
   - Sign in to [MongoDB Atlas](https://cloud.mongodb.com).
   - Create a free (M0) or dedicated cluster. Atlas clusters are multi-node replica sets by default.

2. **Create a Database User**:
   - In the Atlas Console, navigate to **Security** → **Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Assign the role `readWriteAnyDatabase` or `Atlas admin`.
   - **Important — URL-Encoding Passwords**: If your database user password contains special characters (e.g. `@`, `:`, `/`, `?`, `#`, `[`, `]`, `%`, `&`, `+`, `=`), you **must** URL-encode them.
     - For example, `@` becomes `%40`, `#` becomes `%23`, `!` becomes `%21`, `$` becomes `%24`.
     - In JavaScript/Node: `encodeURIComponent('YourPassword!')`.

3. **Configure Network Access (Whitelisting IP)**:
   - In the Atlas Console, navigate to **Security** → **Network Access**.
   - Click **Add IP Address**.
   - For local development, click **Add Current IP Address**.
   - If developing from dynamic locations or environments without a static IP, you can temporarily allow access from anywhere by adding `0.0.0.0/0` (ensure your database user has a strong, unique password).

4. **Obtain Connection String**:
   - In Atlas, navigate to **Deployment** → **Database** → click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection string format:
     ```text
     mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
     ```

5. **Format URI with Database Name `sifon`**:
   - Add `/sifon` immediately before the query parameters:
     ```text
     mongodb+srv://<username>:<password>@<cluster-host>/sifon?retryWrites=true&w=majority
     ```
   - **Do not** append `replicaSet=rs0` to Atlas SRV URIs (replica set discovery is handled automatically by Atlas DNS SRV records).
   - Insert this string into `backend/.env` as `MONGODB_URI`.

---

### Option B: Built-in Zero-Config Local Replica Set (Development)

For rapid offline development, Sifon includes an automated in-memory replica set runner:
```bash
npm run dev:mongo
```
This spawns a transactional replica set on `127.0.0.1:27017` with replica set name `rs0`.
Set in `backend/.env`:
```ini
MONGODB_URI=mongodb://127.0.0.1:27017/sifon?replicaSet=rs0
```

---

### Option C: Local Installed MongoDB Community Service

If running a locally installed MongoDB Windows or Linux service:
1. Enable replication in `mongod.cfg`:
   ```yaml
   replication:
     replSetName: "rs0"
   ```
2. Restart MongoDB service (`Restart-Service MongoDB`).
3. Connect with `mongosh` and run `rs.initiate()`.

---

## Installation & Setup

1. **Clone or Open the Workspace**:
   Ensure you are in the project root directory (`C:\sifon`).

2. **Install All Dependencies**:
   ```bash
   npm run install:all
   ```
   Or install in each directory individually:
   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

3. **Configure Environment Files**:
   - Backend: Copy `backend/.env.example` to `backend/.env` (or verify the existing `backend/.env`). Update `MONGODB_URI` with your MongoDB Atlas connection string.
   - Frontend: Copy `frontend/.env.example` to `frontend/.env` (or verify `frontend/.env`). Ensure `VITE_API_URL=http://localhost:5000/api/v1`.
   - Remember: Restart any running Vite or backend processes after changing `.env` files.

---

## Admin User Creation

Public user registration is disabled for security. Create or verify the administrator account using:

```bash
npm run create-admin
```

To provide custom credentials via CLI environment variables:
```bash
ADMIN_EMAIL=admin@company.com ADMIN_PASSWORD=StrongPassword123! npm run create-admin
```

---

## Development & Seeding

### 1. Seed Demo Data (Development Only)
Seed Areas 1, 2, 3, sample products with opening balances, sample purchases, sales, and return transactions (non-damaged & damaged):
```bash
npm run seed
```

### 2. Start Development Servers

**Option 1: Run Full Stack Concurrently**
```bash
npm run dev
```
Spawns both backend (`http://localhost:5000`) and Vite dev server (`http://localhost:5173`) in one terminal window.

**Option 2: Run Services Separately**
- **Terminal 1 (Backend)**:
  ```bash
  npm run dev:backend
  # or: cd backend && npm run dev
  ```
- **Terminal 2 (Frontend)**:
  ```bash
  npm run dev:frontend
  # or: cd frontend && npm run dev
  ```

**Access Information**:
- Frontend UI: `http://localhost:5173`
- Backend Health / API: `http://localhost:5000/api/v1`
- Default Seeded Admin Login:
  - **Email**: `admin@sifon.local`
  - **Password**: `Admin@Sifon2026!`

---

## Running Automated Tests

Run the complete suite of integration, transaction, concurrency, and acceptance tests:

```bash
npm run test:backend
```

### Test Coverage Highlights:
- **Final Acceptance Scenario** (10-Step End-to-End Workflow)
- **Concurrent Sales Oversell Guard** (race condition mitigation)
- **Sale Reversal Blocking** when active returns exist
- **Area Deactivation Guard** when stock remains
- **Area Deletion Guard** when historical transactions exist
- **Idempotent Submission Verification** (`X-Idempotency-Key`)
- **Ledger-Balance Mathematical Reconciliation**

---

## Inventory Reconciliation Audit

Sifon provides an immutable, read-only reconciliation auditor:

```bash
npm run reconcile
```

This script aggregates every delta from `InventoryMovement` and compares it with `InventoryBalance` records for every product and area across the database. It reports any discrepancy without automatically modifying stock.

---

## Production Build & Deployment

### 1. Build Both Services
Compile backend TypeScript and build the optimized Vite bundle:
```bash
npm run build
```
This runs:
- `cd backend && npm run build` (outputs compiled JavaScript to `backend/dist`)
- `cd frontend && npm run build` (runs `tsc -b && vite build`, embedding `VITE_*` variables into `frontend/dist`)

### 2. Deploying Backend on Render (Web Service)

Sifon's backend is a self-contained Node.js service that deploys seamlessly to [Render](https://render.com).

#### Option A: Automatic Deployment using Render Blueprints
The repository includes a ready-to-use [`render.yaml`](./render.yaml) file:
1. In Render Dashboard, click **New +** $\to$ **Blueprint**.
2. Connect your repository (`https://github.com/nihalcp1108/sifon.git`).
3. Render automatically reads `render.yaml` and provisions the Web Service with the correct configuration.
4. Set your `MONGODB_URI` and `FRONTEND_URL` in the environment settings.

#### Option B: Manual Web Service Setup
1. In Render Dashboard, click **New +** $\to$ **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `sifon-backend`
   - **Region**: Any (e.g. `Oregon (US West)` or `Frankfurt (EU Central)`)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci --include=dev && npm run build`
   - **Start Command**: `node dist/server.js` (or `npm start`)
   - **Plan**: `Free`
4. Under **Advanced** $\to$ **Health Check Path**, enter: `/api/v1/health`
5. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render default)
   - `TIMEZONE`: `Asia/Kolkata`
   - `MONGODB_URI`: `<your-production-mongodb-atlas-uri>`
   - `JWT_SECRET`: `<minimum-32-character-random-secret>`
   - `COOKIE_SECRET`: `<random-secret>`
   - `FRONTEND_URL`: `https://your-frontend-domain.com`
   - `INITIAL_ADMIN_EMAIL`: `admin@sifon.local` (optional, for first startup)
   - `INITIAL_ADMIN_PASSWORD`: `<strong-admin-password>` (optional, for first startup)
   - `INITIAL_ADMIN_NAME`: `Super Admin`

### 3. Deploying Backend on Railway

Sifon's backend deploys seamlessly to [Railway](https://railway.com) as a standalone service. The repository includes dual `railway.json` and `.npmrc` configurations to ensure reproducible builds whether Railway builds from `/backend` or `/` (repository root).

#### Recommended Setup (Root Directory: `/backend`)
1. In Railway Dashboard, create a new project and select **Deploy from GitHub repo**.
2. Connect `https://github.com/nihalcp1108/sifon.git`.
3. In your Railway Service, navigate to **Settings** $\to$ **Source**:
   - Set **Root Directory** to: `/backend`
4. Under **Build**:
   - **Build Command**: `npm ci --include=dev && npm run build` (or leave default; handled automatically by `backend/railway.json` and `backend/.npmrc`)
5. Under **Deploy**:
   - **Start Command**: `node dist/server.js` (or `npm start`)
   - **Healthcheck Path**: `/api/v1/health`
6. Under **Variables**, add the following environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `${{PORT}}` (Railway assigns this automatically)
   - `TIMEZONE`: `Asia/Kolkata`
   - `MONGODB_URI`: `<your-production-mongodb-atlas-uri>`
   - `JWT_SECRET`: `<minimum-32-character-random-secret>`
   - `COOKIE_SECRET`: `<random-secret>`
   - `FRONTEND_URL`: `https://your-vercel-domain.vercel.app` (e.g. `https://sifon.vercel.app`; supports comma-separated list of domains; do not include trailing slash)
   - `INITIAL_ADMIN_EMAIL`: `admin@sifon.local` (optional)
   - `INITIAL_ADMIN_PASSWORD`: `<strong-admin-password>` (optional)
   - `INITIAL_ADMIN_NAME`: `Super Admin`

#### Root Directory Deployment (`/`)
If deploying without specifying a root directory (from repository root `/`), Sifon automatically handles this via root `railway.json`, `.npmrc`, and root `build` script:
- Root `railway.json` instructs Nixpacks to run `npm --prefix backend ci --include=dev && npm --prefix backend run build` and starts with `npm --prefix backend start`.
- Root `package.json` `"build"` script installs backend dependencies with `--include=dev` and compiles TypeScript to `backend/dist`, preventing `tsc: not found` errors.

### 4. Start Backend Locally in Production
Ensure production environment variables are configured in `backend/.env` (with `NODE_ENV=production`), then run:
```bash
# Option A: From project root
npm --prefix backend start

# Option B: Directly from backend directory
cd backend
npm run start
# or: node dist/server.js
```

### 5. Deploying Frontend on Vercel

Sifon's frontend deploys seamlessly to [Vercel](https://vercel.com) as an independent Vite SPA. The repository includes [`frontend/vercel.json`](./frontend/vercel.json) to handle Single Page Application (SPA) client-side routing rewrites so that direct route navigation and page refreshes never return 404.

#### Vercel Project Settings
1. In Vercel Dashboard, click **Add New...** $\to$ **Project**, then import your GitHub repository (`https://github.com/nihalcp1108/sifon.git`).
2. In the project configuration screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and select `frontend` (do **not** leave as repository root)
   - **Build Command**: `npm run build` (or default `vite build`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install` (or `npm ci`)
3. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://<your-railway-backend-domain>/api/v1` (point to your deployed Railway backend)
   - `VITE_APP_NAME`: `Sifon` (optional)
4. Click **Deploy**.
5. Once deployed, copy your Vercel domain (e.g. `https://sifon-frontend.vercel.app`) and add it to your Railway backend's `FRONTEND_URL` environment variable to ensure CORS cookies are accepted.

### 6. SPA Static Hosting & Production Preview
To preview the production frontend build locally:
```bash
npm --prefix frontend run preview
```
For other production hosting providers (NGINX, Caddy, Cloudflare Pages, AWS S3/CloudFront), ensure all non-file requests rewrite to `/index.html`.

---

## API Reference & Collection

All endpoints are prefixed with `/api/v1`.

### Authentication & Account Settings
- `POST /api/v1/auth/login`: Email and password login. Sets `sifon_token` HttpOnly cookie.
- `GET /api/v1/auth/me`: Current authenticated user session.
- `POST /api/v1/auth/logout`: Clears session cookie and invalidates session.
- `PUT /api/v1/auth/email`: Change authenticated admin login email (requires current password confirmation, checks uniqueness, writes audit log, invalidates active sessions).
- `PUT /api/v1/auth/password`: Change authenticated admin password (requires current password confirmation, enforces 12-72 char complexity, prevents password reuse, writes audit log, invalidates active sessions).

### Areas
- `GET /api/v1/areas`: List numbered areas sorted numerically (1, 2, 3, 10...).
- `GET /api/v1/areas/options`: Dedicated lightweight dropdown lookup endpoint sorted strictly in natural numeric order.
- `GET /api/v1/areas/active`: Alias for options lookup.
- `POST /api/v1/areas`: Create numbered area (`{ areaNumber, description }`).
- `GET /api/v1/areas/:id`: Area details (strictly scoped with 24-char ObjectId validation).
- `PUT /api/v1/areas/:id`: Update description or toggle active status.
- `DELETE /api/v1/areas/:id`: Delete area (blocked if inventory history exists).

### Products
- `GET /api/v1/products`: List products with area-wise and total available & damaged balances.
- `GET /api/v1/products/options`: Dedicated lightweight dropdown lookup endpoint with materialized area balances.
- `GET /api/v1/products/active`: Alias for options lookup.
- `POST /api/v1/products`: Create product with optional `openingStock: [{ areaId, quantity }]`.
- `GET /api/v1/products/:id`: Product detail with area breakdown (strictly scoped with 24-char ObjectId validation).
- `GET /api/v1/products/:id/movements`: Paginated immutable movement ledger history.
- `PUT /api/v1/products/:id`: Edit product metadata (name, details, unit, isActive).

### Purchases
- `GET /api/v1/purchases`: List purchases with filters.
- `POST /api/v1/purchases`: Create purchase (`{ purchaseDate, items, notes, isDraft }`).
- `GET /api/v1/purchases/:id`: Purchase details.
- `POST /api/v1/purchases/:id/post`: Post draft purchase.
- `POST /api/v1/purchases/:id/cancel`: Cancel purchase and reverse stock (`{ reason }`).
- `DELETE /api/v1/purchases/:id`: Delete draft purchase.

### Sales
- `GET /api/v1/sales`: List sales with filters.
- `POST /api/v1/sales`: Create sale (`{ saleDate, items, notes, isDraft }`).
- `GET /api/v1/sales/:id`: Sale details and active returned counts.
- `POST /api/v1/sales/:id/post`: Post draft sale.
- `POST /api/v1/sales/:id/cancel`: Cancel sale and restore stock (`{ reason }`, blocked if active returns exist).
- `DELETE /api/v1/sales/:id`: Delete draft sale.

### Returns
- `GET /api/v1/returns`: List customer returns.
- `POST /api/v1/returns`: Record return (`{ returnDate, saleId, saleLineId, receivingAreaId, nonDamagedQuantity, damagedQuantity, reason }`).
- `GET /api/v1/returns/:id`: Return details.
- `POST /api/v1/returns/:id/cancel`: Cancel return and reverse stock (`{ reason }`).

### Damaged Inventory
- `GET /api/v1/damaged/balances`: Current damaged stock balances by product and area.
- `GET /api/v1/damaged/history`: Supporting customer return history for damaged items.

### Stock Statements & Reports
- `GET /api/v1/reports/matrix`: View A — Current Area-Wise Stock Matrix JSON.
- `GET /api/v1/reports/matrix/csv`: Export View A as CSV (CSV injection protected).
- `GET /api/v1/reports/period`: View B — Period Stock Movement Statement JSON.
- `GET /api/v1/reports/period/csv`: Export View B as CSV.

---

## SPA Refresh Routing & Production Considerations

When hosting the React frontend as an SPA, configure your web server to redirect all non-file route requests to `index.html`.

### NGINX Configuration Example:
```nginx
server {
    listen 80;
    server_name sifon.example.com;

    root /var/www/sifon/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Backup Recommendations

1. **MongoDB Database Dump**:
   Schedule daily backups using `mongodump`:
   ```bash
   mongodump --uri="<MONGODB_URI>" --gzip --archive=/backups/sifon-$(date +%Y%m%d).gz
   ```
2. **Point-In-Time Recovery (PITR)**:
   When deploying on MongoDB Atlas, enable Continuous Cloud Backups (PITR) to allow exact point-in-time recovery to the second.
3. **Reconciliation Audit Verification**:
   Run `npm run reconcile` as a recurring cron job. Send alerts if any discrepancy is detected between the immutable ledger and materialized balances.

---

## Known Limitations

- Quantities in this version are strictly positive integers (fractional quantities such as 1.5 kg are outside current scope).
- Damaged inventory write-off, disposal, refurbishment, and dealer accounts are intentionally omitted as per the project specification.
- Backdated postings are permitted up to the start of available history provided they do not produce historical negative balances.

