# 🚀 Agrinet Production Deployment & Federation Launch Kit

This document provides everything needed to:
- Deploy an Agrinet node
- Join the federation
- Enable protocol syncing
- Contribute back to the community as a co-governing peer

Based on Agrinet’s Linux-like protocol-first design, all tooling here respects its principles of modularity, decentralization, and sovereignty.

---

## ✅ 1. System Requirements (For Node Operators)

- Linux VPS or local server (Ubuntu 20.04+, ARM or x86_64)
- Node.js v18+
- MongoDB 5+
- Git installed
- PM2 or systemd to manage background services
- Recommended: Nginx reverse proxy (for TLS and domain routing)

---

## 🛠 2. Deployment Script (PM2 + systemd compatible)

### install.sh (1st-time setup)
```bash
#!/bin/bash
sudo apt update && sudo apt install -y nodejs npm git mongodb

git clone https://github.com/NTARI-ForgeLab/Fruitful.git 
cd Fruitful/backend

cp .env.example .env
npm install

# Setup PM2
npm install -g pm2
pm run build
pm start
pm save

# Optional: systemd version
# pm2 startup systemd && sudo env PATH=$PATH:/home/$USER/.nvm/versions/node/v18/bin pm2 startup systemd -u $USER --hp /home/$USER
```

Add this to crontab if you want auto-sync federation:
```bash
*/30 * * * * curl -s http://localhost:5000/federation/sync
```

---

## 🌍 3. Federation Node Onboarding Guide

Each new peer node should:

1. Clone the protocol backend
2. Configure their .env file with:
   - JWT_SECRET
   - MONGO_URI
   - STRIPE_KEYS (optional)
3. Start the federation background job:
   - Schedule federationSyncJob.js (via PM2 or cron)
4. Register with other known nodes via:
   ```bash
   POST /federation/node/register
   {
     "nodeUrl": "https://node.example.org",
     "region": "Pacific NW",
     "contactEmail": "admin@node.org"
   }
   ```
5. Confirm sync by checking:
   ```bash
   GET /federation/export
   GET /federation/nodes
   GET /logs
   ```

---

## 🔐 4. Federation Security Handshake Spec (v1)

Each federated sync includes:
- Node URL, verified SSL
- Hash-checked payload (timestamp-based CRDT logic)
- Optional: Signed payloads with GPG (coming in v2)

Trust Model:
- Only sync from registered nodes
- Optionally rate peer reliability with LBTAS-node trust layer

To verify payloads:
```bash
GET /federation/export -> returns JSON of listings, users, transactions

Verify:
  - Each item has updatedAt
  - Import only if newer
  - Maintain log of last hash received from each node
```

---

## 📊 5. Community Tools in This Release

- trendsRoutes.js → /trends/* (AI + MongoDB insights)
- depositRoutes.js → Local wallet + Stripe support
- agrotourismRoutes.js → Event + image listings
- transactionLog.js → Auditable events across escrow/rating
- aiTrendHelper.js → Local rule-based AI summary engine

---

## 🧠 6. Git-Based Decentralization Roadmap

Fork Naming Examples:
- agrinet-urbanroots → smart cities
- agrinet-foodforest → permaculture
- agrinet-sahara → desert microgrids
- agrinet-mashamba → Kiswahili agro-coops

---

📦 Agrinet is ready to be deployed like Linux: peer-first, forkable, and sovereign. Let's get your first federation online. 🌐🧱
