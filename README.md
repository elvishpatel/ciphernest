# 🔐 CipherNest

**CipherNest** is a production-grade, zero-knowledge password vault designed for maximum security, privacy, and speed. Built with a modern "Cyber Fortress" aesthetic, it utilizes client-side cryptography to ensure that your sensitive data is never exposed to the server in plaintext.

![CipherNest UI](https://via.placeholder.com/800x450.png?text=CipherNest+Zero-Knowledge+Vault)

## ✨ Core Features

- **Zero-Knowledge Architecture:** Master passwords never leave your device. The server only stores cryptographically secure hashes and encrypted data blobs.
- **Client-Side Cryptography:** Uses `hash-wasm` (Argon2id) for robust Key Derivation and the native Web Crypto API (AES-256-GCM, HMAC-SHA256, HKDF) for fast, secure encryption.
- **Multi-Vault Support:** Organize your credentials into isolated vaults (e.g., Personal, Work, Finance).
- **Emergency Recovery Kit:** Generate a secure, 128-bit `CPHR` key to recover your account if you forget your master password—without breaking zero-knowledge principles.
- **Local Biometric Unlock:** Securely cache your session locally and unlock your vault using WebAuthn (TouchID, FaceID, Windows Hello).
- **Advanced Password Generator:** Multi-mode generator (Memorable, Ultra, API Key, PIN) with real-time entropy scoring.
- **Cyber Fortress UI:** A stunning, fully responsive, glassmorphism UI built with TailwindCSS v4 and Framer Motion.
- **Security Center:** Panic lock (`Ctrl+Shift+L`), auto-clipboard wipe (30s), and a 5-minute inactivity auto-lock.

---

## 🏗️ Technology Stack

- **Frontend:** React 19, Vite 8, Zustand (State), Framer Motion (Animations), TailwindCSS v4, Lucide React (Icons).
- **Backend:** Node.js, Express.js, JSON Web Tokens (JWT) for session management.
- **Database:** Supabase (PostgreSQL).
- **Cryptography:** `hash-wasm` (Argon2id), Web Crypto API.

---

## 🔒 Security & Encryption Model

1. **Key Derivation:** The user's Master Password and a unique Salt are run through **Argon2id** (client-side) to generate a 512-bit Master Key.
2. **Key Splitting:** The Master Key is split using HKDF into two 256-bit keys:
   - **Auth Key:** Hashed via SHA-256 and sent to the server for authentication.
   - **Encryption Key:** Kept strictly in memory. Never persisted to disk.
3. **Data Encryption:** All vault entries are encrypted locally using **AES-256-GCM** with a random Initialization Vector (IV) before being sent to the server.
4. **Recovery:** The Emergency Recovery Kit uses a randomly generated 128-bit key to encrypt the Encryption Key, allowing recovery without exposing the master password.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+)
- A [Supabase](https://supabase.com/) account and project.

### 1. Database Setup
1. Create a new Supabase project.
2. Go to the SQL Editor in Supabase and run the schema files located in the `database/` folder:
   - Run `schema.sql` to create the tables.
   - Run `migrations/add_recovery_fields.sql` to add recovery support.

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   npm install
   ```
2. Create a `.env` file in the `backend` directory with your Supabase credentials and JWT secrets:
   ```env
   PORT=5000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   JWT_SECRET=generate_a_random_string_here
   JWT_REFRESH_SECRET=generate_another_random_string_here
   ```
3. Start the backend server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```
2. The frontend is configured to proxy API requests to `http://localhost:5000` during development (see `vite.config.js`).
3. Start the frontend development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5174` in your browser.

---

## 🌍 Deployment Guide (Going Live)

To make CipherNest available on the internet, you need to deploy the Backend, Frontend, and Database separately.

### 1. Database (Supabase)
Since Supabase is a cloud service, your database is already "live". 
- Ensure you have run all SQL scripts.
- Double-check that **Row Level Security (RLS)** is enabled on all tables (this is handled in `schema.sql`).

### 2. Backend Deployment (Render or Railway)
The Node.js backend needs to be hosted on a service that supports Node applications. **Render.com** or **Railway.app** are great free/low-cost options.

**Deploying on Render:**
1. Push your repository to GitHub.
2. Sign up for [Render](https://render.com/) and click **New -> Web Service**.
3. Connect your GitHub account and select your CipherNest repository.
4. **Configuration:**
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **Environment Variables:** Add all the variables from your `backend/.env` file (`SUPABASE_URL`, `JWT_SECRET`, etc.).
6. Click **Create Web Service**. Once deployed, Render will give you a live URL (e.g., `https://ciphernest-api.onrender.com`).

### 3. Frontend Deployment (Vercel or Netlify)
The React frontend is a static site and can be deployed easily on **Vercel**.

**Deploying on Vercel:**
1. Sign up for [Vercel](https://vercel.com/) and click **Add New -> Project**.
2. Import your GitHub repository.
3. **Configuration:**
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables:**
   - You need to tell the frontend where the live backend is. Since Vite uses a proxy in development, for production, you should prepend the API URL or handle it via Vercel Rewrites.
   - *Fixing API Routing for Production:* Open `frontend/src/lib/api.js`. Change `const API_BASE = '/api';` to point to your live backend URL (e.g., `const API_BASE = 'https://ciphernest-api.onrender.com/api';`), OR configure a `vercel.json` file in the `frontend` folder to rewrite `/api/*` to your Render URL.
5. Click **Deploy**. Vercel will give you a live URL (e.g., `https://ciphernest.vercel.app`).

---

## ⚠️ Important Security Notes for Production
- **HTTPS is Mandatory:** Web Crypto and WebAuthn (Biometrics) *require* a secure context. Ensure your live domain uses HTTPS (Vercel handles this automatically).
- **CORS:** Ensure your backend allows requests from your frontend domain. You may need to add the `cors` package to `backend/server.js` and configure it to accept requests from your Vercel URL.

---
*Built for absolute privacy.*
