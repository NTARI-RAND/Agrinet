> सामुदायिक अनुवाद (मसौदा) — NTARI नीति P2-002, Global Multilingual Broadcast। स्रोत: README.md (मूल पुर्तगाली में, स्नैपशॉट 2026-07-29)। यह मशीन-सहायता से तैयार सामुदायिक मसौदा है, जो P2-002 §3.1 के अनुसार क्षेत्रीय मेंटेनर की समीक्षा हेतु लंबित है। मुख्य तकनीकी विनिर्देश §2.2 के अनुसार अंग्रेज़ी में ही रहेंगे।
>
> अनुवाद में कोई त्रुटि दिखे तो कृपया उसे स्वयं सुधारने में मदद करें:
> रिपॉज़िटरी को फ़ॉर्क (fork) करें और अपना सुधार पुल रिक्वेस्ट (pull request)
> के रूप में भेजें — https://github.com/NTARI-RAND/Agrinet। अनुवाद-सुधार हमारे
> लिए किसी भी अन्य योगदान जितने ही मूल्यवान हैं, और उनका सदा स्वागत है।

# Agrinet — विकेन्द्रीकृत कृषि मार्केटप्लेस

ब्राज़ील के लिए ओपन सोर्स कृषि व्यापार प्लेटफ़ॉर्म। यह उत्पादकों, खरीदारों और सेवा प्रदाताओं को एक सुरक्षित मार्केटप्लेस में जोड़ता है, जिसमें एस्क्रो भुगतान, रीयल-टाइम चैट, एंटी-फ़्रॉड सुविधाएँ और नोड्स के बीच फ़ेडरेटेड सिंक्रोनाइज़ेशन शामिल हैं।

> मूल प्रोजेक्ट [NTARI-RAND/Agrinet](https://github.com/NTARI-RAND/Agrinet) से व्युत्पन्न — [Carlos Zamboni](https://github.com/CarlosZambonii) द्वारा ब्राज़ीलियाई बाज़ार के लिए अनुकूलित।

**सक्रिय डिप्लॉयमेंट:** [https://agrinet.duckdns.org](https://agrinet.duckdns.org)

---

## स्टैक

| परत | तकनीक |
|---|---|
| फ़्रंटएंड | Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui + Framer Motion |
| बैकएंड | Node.js + Express |
| डेटाबेस | MariaDB |
| कैश और क्यू | Redis + BullMQ |
| भुगतान | Stripe (PaymentIntent + एस्क्रो) |
| इमेज अपलोड | Cloudflare R2 |
| रीयल-टाइम | Socket.IO |
| ऑब्ज़र्वेबिलिटी | Prometheus + Grafana |
| ऑथेंटिकेशन | JWT + bcryptjs |
| रिवर्स प्रॉक्सी | nginx (HTTPS, राउटिंग, WebSocket) |
| SSL | Certbot के माध्यम से Let's Encrypt |
| इन्फ्रास्ट्रक्चर | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub → VPS |

---

## सुविधाएँ

- **मार्केटप्लेस** — अनाज, फल, पशुधन, मशीनरी और अन्य वस्तुओं की लिस्टिंग, फ़िल्टर, खोज और सॉर्टिंग के साथ
- **एस्क्रो के साथ भुगतान** — Stripe PaymentIntent, विक्रेता द्वारा रिलीज़, स्वचालित रिफ़ंड
- **वॉलेट** — बैलेंस, क्रेडिट/डेबिट इतिहास, ऑडिट सहित अकाउंटिंग लेजर
- **रीयल-टाइम चैट** — पोलिंग फ़ॉलबैक के साथ Socket.IO, टाइपिंग इंडिकेटर, नोटिफ़िकेशन
- **एंटी-फ़्रॉड** — वेलोसिटी चेक, फ़्रॉड स्कोर, ट्रस्ट लेवल, मॉडरेशन क्यू
- **फ़ेडरेशन** — नेटवर्क के नोड्स के बीच लिस्टिंग और ब्लॉक का सिंक्रोनाइज़ेशन
- **एडमिन पैनल** — आँकड़े, लिस्टिंग मॉडरेशन, विवाद, ऑडिट लॉग
- **इमेज अपलोड** — ड्रैग-एंड-ड्रॉप, Cloudflare R2 में स्टोरेज
- **ऑब्ज़र्वेबिलिटी** — Prometheus मेट्रिक्स, Grafana डैशबोर्ड, कॉन्फ़िगर किए गए अलर्ट

---

## Docker के साथ चलाना (अनुशंसित)

```bash
git clone https://github.com/CarlosZambonii/Agrinet-Brazil
cd Agrinet-Brazil

# Configurar variáveis de ambiente
cp backend/.env.example .env
# Editar .env com JWT_SECRET, STRIPE_*, R2_*, API_KEY

# Subir o stack completo
cd infra/docker
docker compose up -d
```

| सेवा | लोकल URL |
|---|---|
| फ़्रंटएंड | http://localhost:3000 |
| API | http://localhost:5000 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

मॉनिटरिंग को भी शुरू करने के लिए:
```bash
docker compose --profile monitoring up -d
```

### HTTPS के साथ VPS पर डिप्लॉय

प्रोडक्शन स्टैक में nginx का उपयोग रिवर्स प्रॉक्सी के रूप में होता है, जिसमें SSL Let's Encrypt के माध्यम से मिलता है। पूरे चरण-दर-चरण निर्देशों के लिए [`docs/infra.md`](./docs/infra.md) देखें।

---

## लोकल स्तर पर चलाना (डेवलपमेंट)

**पूर्व-आवश्यकताएँ:** Node.js 20+, MariaDB, Redis

```bash
# Backend
cd backend
cp .env.example .env        # preencher variáveis
npm install
mariadb -u root -p < ../schema.sql
node server.js              # sobe em http://localhost:5000

# Frontend (outro terminal)
cd frontend
npm install
# criar frontend/.env.local:
# NEXT_PUBLIC_API_URL=http://localhost:5000
# NEXT_PUBLIC_API_KEY=<valor do API_KEY no .env>
npm run dev                 # sobe em http://localhost:3000
```

---

## एनवायरनमेंट वेरिएबल्स

सभी वेरिएबल्स [`backend/.env.example`](./backend/.env.example) में प्रलेखित हैं। आवश्यक वेरिएबल्स:

| वेरिएबल | विवरण |
|---|---|
| `JWT_SECRET` | JWT टोकन के लिए सीक्रेट की |
| `API_KEY` | API एक्सेस की (हेडर `X-API-Key`) |
| `STRIPE_SECRET_KEY` | Stripe की सीक्रेट की |
| `STRIPE_WEBHOOK_SECRET` | Stripe वेबहुक का सीक्रेट |
| `R2_ACCOUNT_ID` | Cloudflare अकाउंट ID |
| `R2_ACCESS_KEY_ID` | R2 बकेट की एक्सेस की |
| `R2_SECRET_ACCESS_KEY` | R2 बकेट की सीक्रेट की |
| `R2_PUBLIC_URL` | बकेट का सार्वजनिक URL (उदा.: `https://pub-xxx.r2.dev`) |

---

## CI/CD

पाइपलाइन दो शृंखलाबद्ध वर्कफ़्लो से मिलकर बनी है:

**1. `build-and-push.yml`** — `main` पर `backend/`, `frontend/` या `infra/` में बदलाव वाले हर पुश पर ट्रिगर होता है। तीनों इमेज बिल्ड करके Docker Hub पर प्रकाशित करता है:

- `caza6367/agrinet-api:latest`
- `caza6367/agrinet-frontend:latest`
- `caza6367/agrinet-federation-sync:latest`

**2. `deploy.yml`** — बिल्ड वर्कफ़्लो के पूरा होते ही अपने-आप ट्रिगर होता है। SSH के माध्यम से VPS तक पहुँचता है और `docker compose pull && up -d` चलाता है।

**रिपॉज़िटरी में आवश्यक सीक्रेट्स** (`Settings → Secrets → Actions`):

| सीक्रेट | विवरण |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub यूज़रनेम |
| `DOCKERHUB_TOKEN` | Docker Hub एक्सेस टोकन |
| `NEXT_PUBLIC_API_URL` | API का सार्वजनिक URL (उदा.: `https://agrinet.duckdns.org`) |
| `NEXT_PUBLIC_API_KEY` | फ़्रंटएंड के लिए API की |
| `JWT_SECRET` | JWT सीक्रेट (`openssl rand -hex 32` से जनरेट किया गया) |
| `API_KEY` | API एक्सेस की (`openssl rand -hex 32` से जनरेट की गई) |
| `DB_PASSWORD` | MariaDB का पासवर्ड |
| `STRIPE_SECRET_KEY` | Stripe की सीक्रेट की |
| `STRIPE_WEBHOOK_SECRET` | Stripe वेबहुक का सीक्रेट |
| `STRIPE_PUBLISHABLE_KEY` | Stripe की पब्लिशेबल (सार्वजनिक) की |
| `R2_ACCOUNT_ID` | Cloudflare अकाउंट ID |
| `R2_ACCESS_KEY_ID` | R2 बकेट की एक्सेस की |
| `R2_SECRET_ACCESS_KEY` | R2 बकेट की सीक्रेट की |
| `R2_PUBLIC_URL` | R2 बकेट का सार्वजनिक URL |
| `ALLOWED_ORIGINS` | CORS में अनुमत ऑरिजिन (उदा.: `https://agrinet.duckdns.org`) |
| `VPS_HOST` | VPS का IP या होस्टनेम |
| `VPS_USER` | VPS का SSH यूज़र |
| `VPS_SSH_KEY` | VPS तक पहुँच के लिए निजी SSH की |

---

## प्रोजेक्ट संरचना

```
Agrinet-Brazil/
├── backend/                 # API Express + workers
│   ├── routes/              # Rotas HTTP (auth, listings, wallet, chat...)
│   ├── middleware/          # Auth JWT, rate limit, upload
│   ├── lib/                 # DB pool, Redis, métricas, R2 storage
│   ├── migrations/          # Knex migrations
│   ├── workers/             # Job workers (BullMQ)
│   ├── jobs/                # Jobs agendados (expiração de pagamentos)
│   └── Dockerfile
├── frontend/                # Next.js 14 App Router
│   ├── app/                 # Páginas: /, /marketplace, /chat, /perfil, /admin
│   ├── components/          # ListingCard, NewListingModal, Nav, etc.
│   ├── lib/                 # api.js, notifications.js, hooks
│   └── Dockerfile
├── infra/
│   ├── docker/              # docker-compose.yml
│   └── backups/             # Scripts de backup automático do DB
├── monitoring/              # prometheus.yml, alerts.yml, Grafana dashboards
├── docs/                    # Documentação técnica detalhada
├── schema.sql               # Schema completo do banco de dados
└── .github/workflows/       # GitHub Actions CI/CD
```

---

## टेस्ट

```bash
cd backend
npm test          # 24 testes unitários (Jest)
```

कवर की गई सुइट्स: इनपुट सैनिटाइज़ेशन, JWT, authMiddleware, fraudService।

---

## तकनीकी दस्तावेज़ीकरण

पूर्ण दस्तावेज़ीकरण [`docs/`](./docs/README.md) में उपलब्ध है:

| दस्तावेज़ | सामग्री |
|---|---|
| [auth.md](./docs/auth.md) | JWT, रजिस्ट्रेशन, लॉगिन, RBAC, ट्रस्ट लेवल |
| [listings.md](./docs/listings.md) | लिस्टिंग, खोज, फ़िल्टर, इमेज, आँकड़े |
| [transactions.md](./docs/transactions.md) | एस्क्रो, Stripe वेबहुक, विवाद, रेटिंग |
| [wallet.md](./docs/wallet.md) | बैलेंस, अकाउंटिंग लेजर, वित्तीय ऑडिट |
| [chat.md](./docs/chat.md) | संदेश, Socket.IO, नोटिफ़िकेशन |
| [fraud.md](./docs/fraud.md) | वेलोसिटी चेक, फ़्रॉड स्कोर, मॉडरेशन |
| [admin.md](./docs/admin.md) | एडमिन पैनल, ऑडिट लॉग, विवाद |
| [federation.md](./docs/federation.md) | नेटवर्क के नोड्स के बीच सिंक्रोनाइज़ेशन |
| [observability.md](./docs/observability.md) | Prometheus, Grafana, अलर्ट |
| [schema.md](./docs/schema.md) | डेटाबेस की पूर्ण मॉडलिंग |
| [testing.md](./docs/testing.md) | टेस्ट कैसे करें, सत्यापित परिदृश्य |
| [decisions.md](./docs/decisions.md) | आर्किटेक्चरल निर्णय और संदर्भ |

---

## मेंटेनर

**Carlos Zamboni**
- GitHub: [github.com/CarlosZambonii](https://github.com/CarlosZambonii)
- LinkedIn: [linkedin.com/in/carloszambonii](https://www.linkedin.com/in/carloszambonii/)

---

## लाइसेंस

[AGPL-3.0](./LICENSE) — ओपन सोर्स कोड है, और इसे ऐसा ही बने रहना चाहिए।
