# Fruitful API Testing Guide

This guide will help you test the backend API for the Chat-UI components using `curl` commands. It explains expected outputs, common errors, and troubleshooting tips.

---

## 1. Service Ports & Endpoints

| Service   | Port (default) | Usage                |
|-----------|----------------|----------------------|
| Backend   | 5000           | API requests         |
| Frontend  | 3000           | Next.js UI (HTML)    |

Set `API_BASE_URL` to your backend URL before running commands. Use a local fallback only when needed:

```bash
export API_BASE_URL="${API_BASE_URL:-http://api-host:5000}"  # replace api-host for local/CI
```

---

## 2. Authentication

Most API endpoints require a valid API key:
- Pass with header: `x-api-key: <your-key>`

Example:
```bash
curl -X POST "${API_BASE_URL}/conversations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: da2-5z3fzvunwvhwtbyudvutf6x6by" \
  -d '{"title": "Chat QA Demo"}'
```

If your environment does not set `API_BASE_URL`, export it once as shown above.

If you see:  
`{"error":"Unauthorized: Invalid API Key"}`  
→ Your API key is invalid, missing, or not recognized by the backend.

---

## 3. Endpoints & Sample Commands

### Health Check
```bash
curl -X GET "${API_BASE_URL}/health"
```
**Expected Output:**  
- `{"status":"ok"}` (if implemented)
- If you get HTML "Cannot GET /health", the endpoint may not be implemented.

---

### Create Conversation
```bash
curl -X POST "${API_BASE_URL}/conversations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-key>" \
  -d '{"title": "Chat QA Demo"}'
```
**Expected Output:**  
```json
{
  "id": "<conversationId>",
  "title": "Chat QA Demo"
}
```
**Troubleshooting:**  
- HTML "Cannot POST /conversations": Wrong port or backend not listening.
- JSON error: Wrong/missing API key.

---

### Send Message
```bash
curl -X POST "${API_BASE_URL}/messages/<conversationId>" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-key>" \
  -d '{"from":"user","to":"assistant","type":"text","content":"Hello Agrinet!"}'
```
**Expected Output:**  
```json
{
  "id": "<messageId>",
  "status": "sent"
}
```
**Shell Tip:**  
Replace `<conversationId>` with your actual conversation ID.

---

### Get Messages
```bash
curl -X GET "${API_BASE_URL}/messages/<conversationId>" \
  -H "x-api-key: <your-key>"
```
**Expected Output:**  
```json
{
  "messages": [
    { /* ... */ }
  ]
}
```

---

### Streaming (SSE)
```bash
curl -N "${API_BASE_URL}/stream/<conversationId>" \
  -H "Accept: text/event-stream" \
  -H "x-api-key: <your-key>"
```
**Expected Output:**  
- Streaming text in `event:` blocks.
- If you see JSON error: Unauthorized, check your API key.

---

## 4. Common Error Outputs Explained

| Output                                            | Meaning/Action                            |
|---------------------------------------------------|-------------------------------------------|
| `<html>Cannot GET/POST ...</html>`                | Wrong port or endpoint not implemented    |
| `{"error":"Unauthorized: Invalid API Key"}`       | API key invalid, missing, or misconfigured|
| `404: This page could not be found.` (HTML)       | You hit frontend (Next.js), not backend   |
| `zsh: no such file or directory: conversationId`  | Shell misinterpreted placeholder; use real ID|
| `curl: (3) URL rejected: Port number ...`         | Malformed URL or variable interpolation   |

---

## 5. Troubleshooting Checklist

- **Port**: Confirm `API_BASE_URL` points to the backend API (default local port is `5000`).
- **API Key**: Confirm the backend is properly configured and the key is active.
- **Endpoint**: Double-check the exact path and HTTP verb.
- **Variables**: Substitute placeholders (like `<conversationId>`) with actual IDs.
- **Response Format**: Use `jq` for pretty-printing JSON:
    ```bash
    curl ... | jq
    ```

---

## 6. Example Test Script

```bash
#!/usr/bin/env bash

API="${API_BASE_URL:-http://api-host:5000}"
KEY="da2-5z3fzvunwvhwtbyudvutf6x6by"

echo "Health check..."
curl -sS "$API/health" | jq

echo "Create conversation..."
CONV_ID=$(curl -sS -X POST "$API/conversations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"title":"Test"}' | jq -r .id)

echo "Send message..."
curl -sS -X POST "$API/messages/$CONV_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"from":"user","to":"assistant","type":"text","content":"Hello!"}' | jq

echo "Get messages..."
curl -sS "$API/messages/$CONV_ID" \
  -H "x-api-key: $KEY" | jq
```

---

## 7. Backend vs Frontend

- **Frontend** (`FRONTEND_BASE_URL`, example: `http://frontend-host:3000`): For browser access; will always return HTML.
- **Backend** (`API_BASE_URL`, example: `http://api-host:5000`): For API; will return JSON (if working).

---

## 8. API Key Setup

- Check your backend `.env` or config for valid API keys.
- Ensure you restart the backend if you change keys/config.

---

## 9. Reporting Issues

If you still get unclear outputs or errors:
- Check backend logs for errors
- Confirm backend is running and listening on correct port
- Open a GitHub issue with your curl command and full output

---

## 10. Reference

- [Fruitful backend code](https://github.com/NTARI-OpenCoreLab/Fruitful/tree/main/backend)
- [Fruitful frontend code](https://github.com/NTARI-OpenCoreLab/Fruitful/tree/main/frontend)

---

**This guide should make your testing and debugging much easier!**
