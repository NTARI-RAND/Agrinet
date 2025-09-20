# Testing OpenAI Integrations

The automated tests in this directory stub the OpenAI SDK to avoid any real network access.

- `communication_controller.test.js` uses `setClient` from `lib/openaiClient` to inject a mocked client that yields deterministic streaming chunks.
- No real `OPENAI_API_KEY` is required while running the tests because the helper short-circuits when a mock client is provided.
- When exercising the API manually, export an `OPENAI_API_KEY` environment variable and (optionally) `OPENAI_MODEL` or `OPENAI_SYSTEM_PROMPT` to customise completions.

Run the backend test suite with:

```bash
npm test
```

from the `backend` directory.
