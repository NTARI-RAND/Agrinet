# Chat UI Architecture and UX Flow

This document describes the component-level architecture and user-experience flow for the chat interface.

## 1. Conversation Window (Main Chat Area)
- **Component**: `ChatWindow` – renders a scrollable feed of chat bubbles by mapping over a `messages` array.
- **API notes**: See comments in [`src/components/ChatWindow.jsx`](src/components/ChatWindow.jsx) for streaming endpoint and event schemas.
- **Message Model**: `{ id, role, content, timestamp, type }`.
- **Rendering**:
  - `MessageBubble role="user"` – right-aligned with user styling.
  - `MessageBubble role="assistant"` – left-aligned and supports streamed content.
- **Markdown Support**: Content is sanitized and rendered as Markdown with syntax highlighting for code blocks. Tables, images, LaTeX and charts use dedicated sub-renderers.
- **Streaming**: Assistant responses subscribe via WebSocket/SSE and progressively append tokens to local state.

## 2. Input Box (Bottom Bar)
- **Component**: `InputBox` with a `useState` hook controlling the text area.
- **Keybindings**:
  - `Shift+Enter` inserts a newline.
  - `Enter` submits the message via `onSubmit()`.
- **Attachments**: File picker uploads files to the API (stored in S3/CDN with returned metadata).
- **Voice Input**: Microphone button triggers the Web Speech API or a client speech‑to‑text service.
- **State Management**: Input resets after send and is disabled while requests are pending.
- **Accessibility**: Uses `aria-role="textbox"` and works with screen readers.

## 3. Message Actions (Hover Menu)
- **Component**: `MessageActions`, revealed on hover.
- **Copy**: Uses `navigator.clipboard.writeText()` to copy assistant text.
- **Regenerate**: Replays the last user prompt and replaces the assistant response.
- **Feedback**: Like/Dislike buttons send telemetry for fine‑tuning.

## 4. Sidebar (Left Panel)
- **Component**: `Sidebar` with nested `ChatList` entries.
- **API notes**: Comments in [`src/components/Sidebar.jsx`](src/components/Sidebar.jsx) outline conversation/message endpoints, expected JSON, and `x-api-key` usage.
- **New Chat**: Clears `messages[]` and establishes a new conversation identifier.
- **History**: Loaded from `/conversations` and displayed as `ConversationCard` items with lazy‑loaded pagination.
- **Pinned Chats**: Items marked with `pinned: true` render in a dedicated section.
- **State**: A global store (Redux, Zustand, or Context) tracks `currentConversationId`.

## 5. Top Bar (Header Area)
- **Chat Title**: Editable inline field persisted via `PATCH /conversation/:id`.
- **Model Selector**: Dropdown for models such as `Agrinet`, `Agrinet-2`, `Agrinet-3`; selection updates a `currentModel` context used in API payloads.
- **Overflow Menu**: Opens a modal for rename and delete actions.

## 6. Settings & Profile Menu (Bottom‑Left)
- **Component**: `ProfileMenu` with options for:
  - Theme toggle (light/dark/system) via CSS classes or variables.
  - Custom instructions persisted as user preferences and injected into system prompts.
  - Memory toggle influencing API requests.
  - Account management links and menu entries conditioned on authentication plan.

## 7. Extra Features
- **Canvas Mode**: `SplitPane` presents chat alongside an editable document or code pane.
- **Plugins/Integrations**: Dropdown in the input area to trigger plugin selection.
- **Image Input**: Uploaded via multipart form and previewed in message bubbles.
- **Voice Mode**: On mobile, a floating mic button streams audio to an STT engine before sending text.

## 8. System and Developer Considerations
- **Streaming Protocol**: SSE or WebSocket; messages appended through `useEffect` hooks.
- **Virtualization**: Long histories leverage windowed lists to minimize DOM load.
- **Security**:
  - Markdown sanitized with DOMPurify.
  - CSP headers prevent inline scripts.
  - Backend scans uploaded files.
- **Testing**: Jest + React Testing Library with Playwright for end‑to‑end flows.
- **Deployment**: Bundled via Vite or Webpack and deployed to S3+CloudFront or Amplify.

## 9. Buttons Summary
| Button | Function | Developer View |
| --- | --- | --- |
| **Send** | Submit prompt → API call | `onSubmit()` → `POST /chat` → stream response |
| **Attach (+)** | Upload files | `<input type="file">` → API upload returning `file_id` |
| **Mic** | Voice input | Web Speech API or STT service → insert text |
| **Copy** | Copy response | `navigator.clipboard.writeText()` |
| **Regenerate** | Retry response | Replay last user message with new request ID |
| **Like/Dislike** | Feedback | `POST` telemetry event |
| **New Chat** | Start fresh | Reset messages, create new conversation record |
| **Pin** | Save chat | Update conversation metadata `{ pinned: true }` |
| **Rename chat** | Inline edit | `PATCH` conversation title |
| **Delete chat** | Remove conversation | `DELETE` conversation and refresh sidebar |
| **Model selector** | Switch GPT version | Update `currentModel` context and API payload |
| **Theme toggle** | Dark/Light | Toggle CSS class or variables |
| **Memory toggle** | Enable/disable memory | Flip memory flag in API requests |

