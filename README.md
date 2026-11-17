# Account Funds

Multi-page financial activation, live credit/debit dashboard, Truecaller-style Smart SMS notification engine, UTR verification, and standalone Admin Panel.

## 100% Standalone & Ready for GitHub Pages (Deploy From Branch)

Both the **Customer Portal** (`index.html`, `dashboard.html`) and the **Admin Panel** (`admin.html`) run **completely independently** with zero AI Studio or Node/Express backend dependency.

### Publish on GitHub Pages (Deploy from a branch)
1. Push all repository files to your GitHub repository (`main` branch).
2. Open **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment → Source**, select **Deploy from a branch**.
4. Choose branch **`main`** and folder **`/ (root)`**, then click **Save**.
5. Your live links will work directly from your GitHub Pages URL:
   - Customer Login / Registration: `https://<username>.github.io/<repo>/index.html`
   - Customer Dashboard: `https://<username>.github.io/<repo>/dashboard.html`
   - Admin Panel: `https://<username>.github.io/<repo>/admin.html`

> **How Sync Works on GitHub Pages**:
> - **Same Device / Multiple Tabs (Default)**: Customer and Admin pages sync automatically in real time using browser storage (`af_p2_*`) and `BroadcastChannel`. Zero configuration required.
> - **Cross-Device Sync (Phone ↔ PC — Optional)**: Open **Admin Panel → `☁️ Cloud Sync`** and paste your own **Firebase Realtime Database URL** (`https://<your-db>-default-rtdb.firebaseio.com`), or put it permanently into `cloud-config.js` (`rtdbUrl`).

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
Outputs bundled assets into `dist/` (`index.html`, `dashboard.html`, `admin.html`).

## Key Features
- **Customer Portal (`index.html` & `dashboard.html`)**: 10-digit mobile OTP verification, login/registration, bank & IFSC auto-verification, ATM autodebit configuration, ₹399 activation UTR submission, live Credit/Debit transaction engine with ₹300–₹1,500 balance control & 3.5% credit commission, Truecaller Smart SMS notifications with swipe-to-dismiss & audio chime, and ₹199 limit upgrade UTR submission with Official Verified Receipt generation.
- **Standalone Admin Panel (`admin.html`)**: Real-time synced customer roster, inspector modal, UTR verification queue (`All`, `Pending`, `Verified`, `Rejected`), Truecaller SMS log, activity audit trail, JSON backup export/import, and optional `☁️ Cloud Sync` setup.
