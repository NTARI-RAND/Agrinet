> ترجمة مجتمعية (مسودة) — سياسة NTARI رقم P2-002، البث العالمي المتعدد اللغات.
> المصدر: README.md (الأصل بالبرتغالية، لقطة بتاريخ 2026-07-29).
> مسودة مجتمعية بمساعدة آلية، في انتظار مراجعة المشرف الإقليمي وفقًا للبند §3.1 من P2-002.
> تبقى المواصفات التقنية الأساسية بالإنجليزية وفقًا للبند §2.2.
>
> تصحيحات الترجمة مساهمات نرحّب بها ونقدّرها كسائر المساهمات، فإذا لاحظت خطأً
> في هذه الترجمة فيمكنك إصلاحه بنفسك عبر إنشاء fork للمستودع وفتح pull
> request: https://github.com/NTARI-RAND/Agrinet

# Agrinet — سوق زراعي لامركزي

منصّة مفتوحة المصدر للتجارة الزراعية في البرازيل. تربط المنتجين والمشترين ومقدّمي الخدمات في سوق آمن يوفّر مدفوعات بحساب ضمان (escrow)، ومحادثة فورية، ومكافحة للاحتيال، ومزامنة اتحادية بين العُقد.

> مشتقّ من المشروع الأصلي [NTARI-RAND/Agrinet](https://github.com/NTARI-RAND/Agrinet) — مُهيَّأ للسوق البرازيلي بواسطة [Carlos Zamboni](https://github.com/CarlosZambonii).

**النشر الفعّال:** [https://agrinet.duckdns.org](https://agrinet.duckdns.org)

---

## حزمة التقنيات

| الطبقة | التقنية |
|---|---|
| الواجهة الأمامية | Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui + Framer Motion |
| الخدمة الخلفية | Node.js + Express |
| قاعدة البيانات | MariaDB |
| التخزين المؤقت والطوابير | Redis + BullMQ |
| المدفوعات | Stripe (PaymentIntent + حساب ضمان) |
| رفع الصور | Cloudflare R2 |
| التواصل الفوري | Socket.IO |
| قابلية المراقبة | Prometheus + Grafana |
| المصادقة | JWT + bcryptjs |
| الوكيل العكسي | nginx (HTTPS، التوجيه، WebSocket) |
| SSL | Let's Encrypt عبر Certbot |
| البنية التحتية | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub → VPS |

---

## الميزات

- **السوق** — إعلانات للحبوب والفواكه والمواشي والآلات وغيرها، مع مرشّحات وبحث وترتيب
- **مدفوعات بحساب ضمان** — Stripe PaymentIntent، وإفراج البائع عن المبلغ، واسترداد تلقائي
- **المحفظة** — الرصيد، وسجل الإيداعات والسحوبات، ودفتر حسابات قابل للتدقيق
- **محادثة فورية** — Socket.IO مع بديل احتياطي بالاستقصاء (polling)، ومؤشّر الكتابة، والإشعارات
- **مكافحة الاحتيال** — فحص معدّل الطلبات (velocity check)، ودرجة الاحتيال، ومستويات الثقة، وطابور الإشراف
- **الاتحاد (Federation)** — مزامنة الإعلانات وقوائم الحجب بين عُقد الشبكة
- **لوحة الإدارة** — الإحصاءات، والإشراف على الإعلانات، والنزاعات، وسجل التدقيق
- **رفع الصور** — سحب وإفلات، وتخزين على Cloudflare R2
- **قابلية المراقبة** — مقاييس Prometheus، ولوحات Grafana، وتنبيهات مُعدَّة مسبقًا

---

## التشغيل باستخدام Docker (موصى به)

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

| الخدمة | العنوان المحلي |
|---|---|
| الواجهة الأمامية | http://localhost:3000 |
| الـ API | http://localhost:5000 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

ولتشغيل خدمات المراقبة أيضًا:
```bash
docker compose --profile monitoring up -d
```

### النشر على سيرفر خاص افتراضي (VPS) مع HTTPS

تستخدم حزمة الإنتاج nginx كوكيل عكسي مع SSL عبر Let's Encrypt. راجع [`docs/infra.md`](./docs/infra.md) للحصول على الخطوات الكاملة.

---

## التشغيل محليًا (بيئة التطوير)

**المتطلبات المسبقة:** Node.js 20+، MariaDB، Redis

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

## متغيّرات البيئة

جميعها موثّقة في [`backend/.env.example`](./backend/.env.example). وأهمّها:

| المتغيّر | الوصف |
|---|---|
| `JWT_SECRET` | المفتاح السري لرموز JWT |
| `API_KEY` | مفتاح الوصول إلى الـ API (في ترويسة `X-API-Key`) |
| `STRIPE_SECRET_KEY` | المفتاح السري لـ Stripe |
| `STRIPE_WEBHOOK_SECRET` | سرّ الـ webhook الخاص بـ Stripe |
| `R2_ACCOUNT_ID` | معرّف حساب Cloudflare |
| `R2_ACCESS_KEY_ID` | مفتاح الوصول إلى حزمة (bucket) R2 |
| `R2_SECRET_ACCESS_KEY` | المفتاح السري لحزمة R2 |
| `R2_PUBLIC_URL` | العنوان العام للحزمة (مثال: `https://pub-xxx.r2.dev`) |

---

## CI/CD

يتكوّن خط الإنتاج (pipeline) من مسارَي عمل (workflows) متسلسلين:

**1. `build-and-push.yml`** — يُطلَق عند كل دفع (push) إلى `main` يتضمّن تغييرات في `backend/` أو `frontend/` أو `infra/`. يبني الصور الثلاث وينشرها على Docker Hub:

- `caza6367/agrinet-api:latest`
- `caza6367/agrinet-frontend:latest`
- `caza6367/agrinet-federation-sync:latest`

**2. `deploy.yml`** — يُطلَق تلقائيًا عند انتهاء مسار البناء. يتّصل بالـ VPS عبر SSH وينفّذ `docker compose pull && up -d`.

**الأسرار (Secrets) المطلوبة في المستودع** (`Settings → Secrets → Actions`):

| السرّ | الوصف |
|---|---|
| `DOCKERHUB_USERNAME` | اسم المستخدم في Docker Hub |
| `DOCKERHUB_TOKEN` | رمز الوصول إلى Docker Hub |
| `NEXT_PUBLIC_API_URL` | العنوان العام للـ API (مثال: `https://agrinet.duckdns.org`) |
| `NEXT_PUBLIC_API_KEY` | مفتاح الـ API الخاص بالواجهة الأمامية |
| `JWT_SECRET` | سرّ JWT (يُولَّد بالأمر `openssl rand -hex 32`) |
| `API_KEY` | مفتاح الوصول إلى الـ API (يُولَّد بالأمر `openssl rand -hex 32`) |
| `DB_PASSWORD` | كلمة مرور MariaDB |
| `STRIPE_SECRET_KEY` | المفتاح السري لـ Stripe |
| `STRIPE_WEBHOOK_SECRET` | سرّ الـ webhook الخاص بـ Stripe |
| `STRIPE_PUBLISHABLE_KEY` | المفتاح العام لـ Stripe |
| `R2_ACCOUNT_ID` | معرّف حساب Cloudflare |
| `R2_ACCESS_KEY_ID` | مفتاح الوصول إلى حزمة R2 |
| `R2_SECRET_ACCESS_KEY` | المفتاح السري لحزمة R2 |
| `R2_PUBLIC_URL` | العنوان العام لحزمة R2 |
| `ALLOWED_ORIGINS` | الأصول (origins) المسموح بها في CORS (مثال: `https://agrinet.duckdns.org`) |
| `VPS_HOST` | عنوان IP أو اسم مضيف الـ VPS |
| `VPS_USER` | مستخدم SSH على الـ VPS |
| `VPS_SSH_KEY` | المفتاح الخاص لـ SSH للوصول إلى الـ VPS |

---

## هيكل المشروع

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

## الاختبارات

```bash
cd backend
npm test          # 24 testes unitários (Jest)
```

الحِزم المُغطّاة بالاختبارات: تنقية المدخلات، وJWT، وauthMiddleware، وfraudService.

---

## التوثيق التقني

التوثيق الكامل في [`docs/`](./docs/README.md):

| المستند | المحتوى |
|---|---|
| [auth.md](./docs/auth.md) | JWT، التسجيل، تسجيل الدخول، RBAC، مستويات الثقة |
| [listings.md](./docs/listings.md) | الإعلانات، البحث، المرشّحات، الصور، الإحصاءات |
| [transactions.md](./docs/transactions.md) | حساب الضمان، وwebhooks الخاصة بـ Stripe، والنزاعات، والتقييم |
| [wallet.md](./docs/wallet.md) | الرصيد، ودفتر الحسابات، والتدقيق المالي |
| [chat.md](./docs/chat.md) | الرسائل، Socket.IO، الإشعارات |
| [fraud.md](./docs/fraud.md) | فحص معدّل الطلبات، درجة الاحتيال، الإشراف |
| [admin.md](./docs/admin.md) | لوحة الإدارة، سجل التدقيق، النزاعات |
| [federation.md](./docs/federation.md) | المزامنة بين عُقد الشبكة |
| [observability.md](./docs/observability.md) | Prometheus، Grafana، التنبيهات |
| [schema.md](./docs/schema.md) | النمذجة الكاملة لقاعدة البيانات |
| [testing.md](./docs/testing.md) | كيفية الاختبار، والسيناريوهات المُتحقَّق منها |
| [decisions.md](./docs/decisions.md) | القرارات المعمارية وسياقها |

---

## القائم على الصيانة

**Carlos Zamboni**
- GitHub: [github.com/CarlosZambonii](https://github.com/CarlosZambonii)
- LinkedIn: [linkedin.com/in/carloszambonii](https://www.linkedin.com/in/carloszambonii/)

---

## الترخيص

[AGPL-3.0](./LICENSE) — مفتوح المصدر، ويجب أن يبقى كذلك.
