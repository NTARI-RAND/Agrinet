> सामुदायिक अनुवाद (मसौदा) — NTARI नीति P2-002, Global Multilingual Broadcast। स्रोत: README.md (अंग्रेज़ी मूल, स्नैपशॉट 2026-07-29)। यह मशीन-सहायता से तैयार सामुदायिक मसौदा है, जो P2-002 §3.1 के अनुसार क्षेत्रीय मेंटेनर की समीक्षा हेतु लंबित है। §2.2 के अनुसार मुख्य तकनीकी विनिर्देश अंग्रेज़ी में ही रहते हैं।
>
> अनुवाद में कोई त्रुटि दिखे तो कृपया उसे स्वयं सुधारने में मदद करें:
> रिपॉज़िटरी को फ़ॉर्क (fork) करें और अपना सुधार पुल रिक्वेस्ट (pull request)
> के रूप में भेजें — https://github.com/NTARI-RAND/Agrinet। अनुवाद-सुधार हमारे
> लिए किसी भी अन्य योगदान जितने ही मूल्यवान हैं, और उनका सदा स्वागत है।

# Fruitful बैकएंड (Agrinet प्लेटफ़ॉर्म)

यह बैकएंड Node.js, Express और स्ट्रीमिंग चैट अपडेट के लिए Server-Sent Events (SSE) का उपयोग करते हुए Agrinet सेवाओं को संचालित करता है।

## अवलोकन

- रनटाइम: Node.js + Express
- डेटाबेस: MariaDB / MySQL (लोकल-फ़र्स्ट आर्किटेक्चर)
- स्ट्रीमिंग: SSE (`/events`, `/stream/:conversationId`)
- प्रमाणीकरण (Auth): JWT मिडलवेयर; कुछ एंडपॉइंट्स के लिए API Key समर्थन
- क्यू (Queues): SMS और बैकग्राउंड जॉब्स के लिए BullMQ
- अपलोड: फ़ाइलें `backend/uploads` के अंतर्गत संग्रहीत होती हैं और `/uploads` पर सर्व की जाती हैं

## त्वरित शुरुआत (Quickstart)

```bash
cd backend
npm install
node server.js
```

Docker-आधारित लोकल डेवलपमेंट:
```bash
docker compose up --build
```

API आमतौर पर पोर्ट 5000 पर चलता है (docker-compose देखें)।

## एनवायरनमेंट

आवश्यक (या `.env` के माध्यम से सेट करें):
- JWT_SECRET
- TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (SMS के लिए; वैकल्पिक TWILIO_STATUS_CALLBACK_URL)
- STRIPE_KEY (यदि डिपॉज़िट सक्षम हैं)

## Redis कॉन्फ़िगरेशन

Redis चलाने के लिए, सुनिश्चित करें कि यह आपकी `docker-compose.yml` फ़ाइल में शामिल है:

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

`.env` में निम्नलिखित एनवायरनमेंट वेरिएबल सेट करें:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

ये सेटिंग्स बैकएंड सेवाओं को क्यू प्रबंधन और अन्य कार्यों के लिए Redis से कनेक्ट होने की अनुमति देती हैं।

## रूटिंग

मुख्य माउंट्स (`server.js` देखें):
- `/health` – हेल्थ चेक
- `/uploads/*` – स्टैटिक अपलोड
- `/events` – SSE ब्रॉडकास्ट चैनल
- `/stream/:conversationId` – प्रति-वार्तालाप SSE स्ट्रीम

डोमेन रूट्स (जब मिनिमल मोड में न हो):
- `/api/marketplace` → मार्केटप्लेस
- `/users` → उपयोगकर्ता प्रबंधन
- `/federation` → फ़ेडरेशन सिंक

## चैट और स्ट्रीमिंग

एंडपॉइंट्स (Chat UI द्वारा उपयोग किए जाते हैं):
- `GET /conversations` → सूची
- `POST /conversations` → बनाना
- `PUT /conversations/:id` → नाम बदलना
- `POST /conversations/:id/pin` → पिन टॉगल करना
- `DELETE /conversations/:id` → हटाना
- `GET /messages/:conversationId` → संदेशों की सूची
- `POST /messages/:conversationId` → संदेश भेजना (वैकल्पिक रूप से फ़ाइल के साथ)
- `GET /stream/:conversationId` (SSE) → इवेंट्स:
  - `token`: `{ id, token }`
  - `message`: `{ message }`

सर्वर एमिटर (ग्लोबल):
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## लेन-देन और सूचनाएँ

- `POST /api/marketplace/transactions`
- `POST /api/marketplace/transactions/release-escrow`
- `POST /api/marketplace/transactions/rate`
- `POST /api/marketplace/transactions/ping`

## सुरक्षा और प्रमाणीकरण

- CORS: `https://www.ntari.org` तक सीमित
- JWT: मिडलवेयर संरक्षित रूट्स पर प्राधिकरण (authorization) लागू करता है
- SSE के लिए API Key: Chat UI SSE अनुरोधों के लिए `x-api-key` क्वेरी पैरामीटर के रूप में एक API key पास करता है; सर्वर `/events` और `[...]` पर `x-api-key` (और बैकवर्ड कम्पैटिबिलिटी के लिए `api_key` भी) स्वीकार करता है

## जॉब्स और SMS

- `bull/smsQueue.js`: BullMQ वर्कर जो Twilio के माध्यम से SMS भेजता है
- `routes/smsRoutes.js`: इनकमिंग/स्टेटस के लिए वेबहुक्स
- Docker Compose में बैकग्राउंड वर्कर्स:
  - `federation-sync`, `key-expiry-cleaner`

## उपयोगी पाथ

- एंट्री: `backend/server.js`
- मॉडल: `backend/models/*`
- रूट्स: `backend/routes/*`
- रिपॉज़िटरीज़: `backend/repositories/*`
- यूटिल्स: `backend/utils/*`
- क्यू: `backend/bull/*`
- अपलोड: `backend/uploads`

## परीक्षण (Testing)

वर्तमान टेस्ट कमांड के लिए `backend/package.json` देखें।

---
योगदान का स्वागत है! कृपया रूट्स और लॉजिक को डोमेन फ़ोल्डरों में जोड़कर `server.js` को हल्का (slim) बनाए रखें।
