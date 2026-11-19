# Account Funds

Multi-page financial activation, live credit/debit dashboard, Truecaller-style Smart SMS notification engine, UTR verification, and standalone Admin Panel.

## 100% Standalone & Ready for GitHub Pages (Deploy From Branch)

Both the **Customer Portal** (`index.html`, `dashboard.html`) and the **Admin Panel** (`admin/index.html`) run **100% independently** with zero AI Studio or Node/Express backend dependency. Even when AI Studio is completely off, both portals work live across all devices.

### Option A: Publish Everything on GitHub Pages (Deploy from a branch)
1. Push all repository files to your GitHub repository (`main` branch).
2. Open **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment → Source**, select **Deploy from a branch**.
4. Choose branch **`main`** and folder **`/ (root)`**, then click **Save**.
5. Your live links work directly from GitHub Pages:
   - Customer Login / Registration: `https://<username>.github.io/<repo>/index.html`
   - Customer Dashboard: `https://<username>.github.io/<repo>/dashboard.html`
   - Admin Panel: `https://<username>.github.io/<repo>/admin/` (or `/admin.html`)

### Option B: Publish Admin Panel on a Separate Branch / Repository
1. Push the contents of the `admin/` folder to its own GitHub repository or branch (make sure `index.html`, `admin.js`, `firebase-client.js`, `cloud-config.js`, `style.css`, `.nojekyll`, and `assets/` are all included).
2. Enable **GitHub Pages → Deploy from a branch** on that repository/branch.
3. Because the `admin/` folder is completely self-contained and connects directly to Cloud Firestore (or your optional Firebase RTDB URL via `☁️ Cloud Sync`), it syncs live with the Customer Portal with zero server or AI Studio dependency.

> **How Real-Time Cross-Device Sync Works**:
> - **Cloud Firestore Live Sync (Default)**: Customer and Admin pages connect directly to Cloud Firestore via official Firebase Web SDK ESM (with automatic long-polling fallback, eager server fetch, and automatic reconnect), so registrations, logins, bank/IFSC links, ATM details, UTRs, approvals, and SMS logs sync across phones and PCs even when AI Studio is off.
> - **Custom Firebase RTDB Override (Optional)**: Open **Admin Panel → `☁️ Cloud Sync`** and paste your own **Firebase Realtime Database URL** (`https://<your-db>-default-rtdb.firebaseio.com`), or put it permanently into `cloud-config.js` & `admin/cloud-config.js` (`rtdbUrl`).

## Local Development (Optional Full-Stack Server)

### Prerequisites
- Node.js 20+

### Run Express + Vite Dev Server
```bash
npm install
npm run dev
```
Runs on `http://localhost:3000`.

### Production Vite Build (Optional)
```bash
npm run build
npm run preview
```
Outputs bundled assets into `dist/` (`index.html`, `dashboard.html`, `admin/index.html`).

## Key Features
- **Customer Portal (`index.html` & `dashboard.html`)**: 10-digit mobile OTP verification, login/registration, bank & IFSC auto-verification, ATM autodebit configuration, ₹399 activation UTR submission, live Credit/Debit transaction engine with ₹300–₹1,500 balance control & 3.5% credit commission, Truecaller Smart SMS notifications with swipe-to-dismiss & audio chime, and ₹199 limit upgrade UTR submission with Official Verified Receipt generation.
- **Standalone Admin Panel (`admin/index.html`)**: 100% independent real-time synced customer roster, inspector modal, UTR verification queue (`All`, `Pending`, `Verified`, `Rejected`), Truecaller SMS log, activity audit trail, JSON backup export, and optional `☁️ Cloud Sync` setup.
