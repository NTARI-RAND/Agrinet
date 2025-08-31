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
- AWS DynamoDB 5+
- Git installed
- PM2 or systemd to manage background services
- Recommended: Nginx reverse proxy (for TLS and domain routing)

---

## 🛠 2. Deployment Script (PM2 + systemd compatible)

### install.sh (1st-time setup)
```bash
#!/bin/bash
sudo apt update && sudo apt install -y nodejs npm git dynamodb

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

Add this to crontab if you want auto-sync federation (ensure `BACKEND_URL` is set to your backend's URL):
```bash
*/30 * * * * curl -s $BACKEND_URL/federation/sync
```

---

## 🌍 3. Federation Node Onboarding Guide

Each new peer node should:

1. Clone the protocol backend
2. Configure their .env file with:
   - JWT_SECRET
   - AWS_SECRET
   - STRIPE_KEYS (optional)
3. Start the federation background job:
   - Set `BACKEND_URL` to your node's base URL and schedule `federationSyncJob.js` (via PM2 or cron)
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

## 🔗 5. Federation Compliance Rules
I. To be federated:
- Use the exact transmission string format: key1/key2/UI_string.
- Store user data according to Agrinet key-auth standards.
- Implement the Open Dialog and Mycelium sync modules.
- Ensure every transaction is LBTAS rated.

### Legal & Licensing
II. Agrinet is licensed under GNU GPL v3.0. Your fork:
- Must remain open-source.
- Cannot restrict access or charge license fees.
- Must include the original license and clearly indicate any modifications.


## 📊 6. Community Tools in This Release

- trendsRoutes.js → /trends/* (AI + DynamoDB insights)
- depositRoutes.js → Local wallet + Stripe support
- agrotourismRoutes.js → Event + image listings
- transactionLog.js → Auditable events across escrow/rating
- aiTrendHelper.js → Local rule-based AI summary engine

---

## 🧠 7. Git-Based Decentralization Roadmap

Fork Naming Examples:
- agrinet-urbanroots → smart cities
- agrinet-foodforest → permaculture
- agrinet-sahara → desert microgrids
- agrinet-mashamba → Kiswahili agro-coops

## 🖥 8. Federation Status CLI
A command-line tool is provided to check the health of your federation and all connected peer nodes.

Features:
- Calls your local Agrinet node’s /federation/status endpoint
- Displays a colored, formatted table of all peer nodes
- Shows last sync time and data counts (listings, transactions, users)
- Uses chalk and cli-table3 for formatting

How to run:
```bash
cd frontend
node federationStatusCLI.js
```

You’ll see a report like:
```
🌍 Federation Node Status Report
┌─────────────────────────────┬────────────┬───────────┬──────────────┬─────────┬───────────────┐
│ Node URL                    │ Status     │ Listings  │ Transactions │ Users   │ Last Sync     │
├─────────────────────────────┼────────────┼───────────┼──────────────┼─────────┼───────────────┤
│ http://node1.example.org    │ ✅ ONLINE  │ 123       │ 456          │ 10      │ 5/20/2025 ... │
│ http://node2.example.org    │ ❌ OFFLINE │ -         │ -            │ -       │ N/A           │
└─────────────────────────────┴────────────┴───────────┴──────────────┴─────────┴───────────────┘
```

Install required dependencies if needed:
```bash
npm install chalk cli-table3 axios
```
---

## 📘 Appendix: Node Template (Recursion Format)

```json
{
  "nodeId": "node-1",
  "production": {
    "capabilities": []
  },
  "services": {
    "educational": [],
    "socialMedia": [],
    "extension": [],
    "financial": {
      "marketListings": [],
      "grants": []
    },
    "marketing": {
      "onNetwork": [],
      "socialMediaSyndication": []
    },
    "messaging": {
      "enabled": false,
      "levesonRatings": []
    }
  },
  "reputation": { "leveson": 0 },
  "interoperability": [],
  "support": {
    "compostingGrazing": [],
    "environmentalServices": [],
    "labor": [],
    "collectiveManagement": []
  }
}
```

This recursive template mirrors Agrinet WP section 4 and helps nodes document capabilities, services, and support resources.

---

📦 Agrinet is ready to be deployed like Linux: peer-first, forkable, and sovereign. Let's get your first federation online. 🌐🧱
