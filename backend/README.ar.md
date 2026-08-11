> ترجمة مجتمعية (مسوّدة) — سياسة NTARI رقم P2-002، البث العالمي المتعدد اللغات. المصدر: README.md (الأصل الإنجليزي، لقطة بتاريخ 2026-07-29). مسوّدة مجتمعية بمساعدة آلية في انتظار مراجعة مسؤول الصيانة الإقليمي وفقًا للمادة §3.1 من P2-002. تبقى المواصفات التقنية الأساسية بالإنجليزية وفقًا للمادة §2.2.
>
> تصحيحات الترجمة مساهمات نرحّب بها ونقدّرها كسائر المساهمات، فإذا لاحظت خطأً
> في هذه الترجمة فيمكنك إصلاحه بنفسك عبر إنشاء fork للمستودع وفتح pull
> request: https://github.com/NTARI-RAND/Agrinet

# الواجهة الخلفية لـ Fruitful (منصة Agrinet)

تُشغّل هذه الواجهة الخلفية خدمات Agrinet باستخدام Node.js وExpress وتقنية Server-Sent Events (SSE) لبثّ تحديثات المحادثة.

## نظرة عامة

- بيئة التشغيل: Node.js + Express
- قاعدة البيانات: MariaDB / MySQL (بنية تعتمد المحلي أولًا)
- البثّ: SSE (`/events`، `/stream/:conversationId`)
- المصادقة: وسيط JWT؛ مع دعم مفاتيح API لبعض نقاط النهاية
- الطوابير: BullMQ للرسائل النصية القصيرة (SMS) والمهام الخلفية
- التحميلات: تُخزَّن الملفات داخل `backend/uploads` وتُقدَّم عبر `/uploads`

## البدء السريع

```bash
cd backend
npm install
node server.js
```

بيئة تطوير محلية قائمة على Docker:
```bash
docker compose up --build
```

تعمل واجهة API عادةً على المنفذ 5000 (راجع docker-compose).

## البيئة

المتغيّرات المطلوبة (أو تُضبط عبر `.env`):
- JWT_SECRET
- TWILIO_SID، TWILIO_AUTH_TOKEN، TWILIO_FROM_NUMBER (للرسائل النصية القصيرة؛ واختياريًا TWILIO_STATUS_CALLBACK_URL)
- STRIPE_KEY (إذا كانت الإيداعات مُمكَّنة)

## إعداد Redis

لتشغيل Redis، تأكّد من تضمينه في ملف `docker-compose.yml` الخاص بك:

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

اضبط متغيّرات البيئة التالية في `.env`:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

تتيح هذه الإعدادات لخدمات الواجهة الخلفية الاتصال بـ Redis لإدارة الطوابير ومهام أخرى.

## التوجيه

نقاط التركيب الرئيسية (راجع `server.js`):
- `/health` – فحص السلامة
- `/uploads/*` – التحميلات الثابتة
- `/events` – قناة بثّ SSE
- `/stream/:conversationId` – بثّ SSE لكل محادثة على حدة

مسارات النطاق (عند عدم التشغيل في الوضع المصغّر):
- `/api/marketplace` → السوق
- `/users` → إدارة المستخدمين
- `/federation` → مزامنة الاتحاد

## المحادثة والبثّ

نقاط النهاية (تستخدمها واجهة المحادثة):
- `GET /conversations` → عرض القائمة
- `POST /conversations` → إنشاء
- `PUT /conversations/:id` → إعادة التسمية
- `POST /conversations/:id/pin` → تبديل التثبيت
- `DELETE /conversations/:id` → حذف
- `GET /messages/:conversationId` → عرض قائمة الرسائل
- `POST /messages/:conversationId` → إرسال رسالة (مع ملف اختياريًا)
- `GET /stream/:conversationId` (SSE) → الأحداث:
  - `token`: `{ id, token }`
  - `message`: `{ message }`

مُصدِرات الأحداث في الخادم (عامة):
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## المعاملات والإشعارات

- `POST /api/marketplace/transactions`
- `POST /api/marketplace/transactions/release-escrow`
- `POST /api/marketplace/transactions/rate`
- `POST /api/marketplace/transactions/ping`

## الأمان والمصادقة

- CORS: مقيَّد على `https://www.ntari.org`
- JWT: يفرض الوسيط التحقّق من التخويل على المسارات المحميّة
- مفتاح API للبثّ SSE: تُمرّر واجهة المحادثة مفتاح API كمعامل استعلام باسم `x-api-key` في طلبات SSE؛ ويقبل الخادم `x-api-key` (وكذلك `api_key` للتوافق مع الإصدارات السابقة) على `/events` و`[...]`

## المهام والرسائل النصية القصيرة

- `bull/smsQueue.js`: عامل BullMQ يُرسل الرسائل النصية القصيرة عبر Twilio
- `routes/smsRoutes.js`: خطافات الويب للرسائل الواردة وحالاتها
- العمّال الخلفيون في Docker Compose:
  - `federation-sync`، `key-expiry-cleaner`

## مسارات مفيدة

- نقطة الدخول: `backend/server.js`
- النماذج: `backend/models/*`
- المسارات: `backend/routes/*`
- المستودعات: `backend/repositories/*`
- الأدوات المساعدة: `backend/utils/*`
- الطوابير: `backend/bull/*`
- التحميلات: `backend/uploads`

## الاختبار

راجع `backend/package.json` للاطلاع على أوامر الاختبار الحالية.

---
المساهمات مُرحَّب بها! يُرجى الحفاظ على ملف `server.js` مُختصرًا من خلال إضافة المسارات والمنطق داخل مجلدات النطاق.
