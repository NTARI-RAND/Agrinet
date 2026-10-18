# Quality checks

Use Node.js 22.12 or newer and install all three lockfiles:

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix frontend/chat-ui
```

Run the repository gates from the root:

```sh
qlty check --all --no-fix --no-cache --fail-level note
qlty smells --all
npm test --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix frontend/chat-ui
npm run build --prefix frontend/chat-ui
./scripts/list-hardcoded-urls.sh
```

`backend/scripts/test.js` discovers every `*.test.js` file and runs Node and Jest tests with their respective runners. DynamoDB and payment tests use local test doubles; they require no production credentials.

The frontend pins the Next.js lint plugin to 14.2.35 because newer plugin branches depend on the unpatched `braces` package. Its legacy ESLint configuration works with the Next.js 15 preset. PostCSS and the backend test runner's YAML parser have patched overrides; retain these until their parents resolve safe versions.

The Qlty baseline on 2026-10-17 had 69 findings, 14 production smell locations, and a broken ESLint invocation. No issue suppressions or reduced smell thresholds were added to clear that baseline.
