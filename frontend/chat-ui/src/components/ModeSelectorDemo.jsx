import React, { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import api, { API_BASE_URL } from "../api";

/**
 * Chat Mode Selector Component Set (drop-in demo)
 * - TailwindCSS for styling
 * - No external state libs; uses Context + useReducer
 * - Accessible radio-group for mode selection
 * - File/photo attachments with chips
 * - Mock Connectors modal (Drive, GitHub, SharePoint, Box)
 * - Progress toasts + banner for Deep Research
 * - Image generation mock gallery
 * - Clean, modern aesthetic (cards, rounded-2xl, soft shadows)
 *
 * Usage: export default <DemoApp /> (below)
 * You can lift <ChatComposer /> into your app and wire the onSubmit handler.
 */

// ------------------------------
// Types
// ------------------------------

// Note: TypeScript-style definitions left as comments for reference
// type Mode = "chat" | "deep" | "image" | "connectors";
// type ConnectorId = "google-drive" | "github" | "sharepoint" | "box";

// ------------------------------
// Tiny global store (Context + useReducer)
// ------------------------------

// type State = {
//   mode: Mode;
//   files: File[];
//   connectorsOpen: boolean;
//   selectedConnectors: Set<ConnectorId>;
//   toasts: Array<{ id: string; title: string; desc?: string; kind?: "info" | "success" | "error" }>; 
//   deepProgress: {
//     running: boolean;
//     stage: "idle" | "planning" | "searching" | "synthesizing" | "finalizing";
//     startedAt?: number;
//     log: string[];
//   };
//   results: {
//     text?: string;
//     images?: string[]; // data URLs for mock image generation
//     citations?: Array<{ title: string; url: string }>;
//   };
// };

// type Action =
//   | { type: "SET_MODE"; mode: Mode }
//   | { type: "ADD_FILES"; files: File[] }
//   | { type: "REMOVE_FILE"; index: number }
//   | { type: "OPEN_CONNECTORS"; open: boolean }
//   | { type: "TOGGLE_CONNECTOR"; id: ConnectorId }
//   | { type: "ADD_TOAST"; toast: State["toasts"][number] }
//   | { type: "REMOVE_TOAST"; id: string }
//   | { type: "DEEP_START" }
//   | { type: "DEEP_SET_STAGE"; stage: State["deepProgress"]["stage"]; log?: string }
//   | { type: "DEEP_STOP" }
//   | { type: "SET_RESULTS"; results: Partial<State["results"]> }
//   | { type: "RESET_RESULTS" };

const initialState = {
  mode: "chat",
  files: [],
  connectorsOpen: false,
  selectedConnectors: new Set(),
  toasts: [],
  deepProgress: { running: false, stage: "idle", log: [] },
  results: {},
};

const StoreContext = React.createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "ADD_FILES": {
      const next = [...state.files];
      action.files.forEach((f) => {
        if (!next.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
          next.push(f);
        }
      });
      return { ...state, files: next };
    }
    case "REMOVE_FILE": {
      const next = [...state.files];
      next.splice(action.index, 1);
      return { ...state, files: next };
    }
    case "OPEN_CONNECTORS":
      return { ...state, connectorsOpen: action.open };
    case "TOGGLE_CONNECTOR": {
      const s = new Set(state.selectedConnectors);
      if (s.has(action.id)) s.delete(action.id); else s.add(action.id);
      return { ...state, selectedConnectors: s };
    }
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] };
    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "DEEP_START":
      return { ...state, deepProgress: { running: true, stage: "planning", startedAt: Date.now(), log: [] } };
    case "DEEP_SET_STAGE": {
      const log = [...state.deepProgress.log];
      if (action.log) log.push(action.log);
      return { ...state, deepProgress: { ...state.deepProgress, stage: action.stage, log } };
    }
    case "DEEP_STOP":
      return { ...state, deepProgress: { running: false, stage: "idle", log: [] } };
    case "SET_RESULTS":
      return { ...state, results: { ...state.results, ...action.results } };
    case "RESET_RESULTS":
      return { ...state, results: {} };
    default:
      return state;
  }
}

function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ------------------------------
// Utility helpers
// ------------------------------

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const API_KEY = import.meta.env.VITE_API_KEY || "";

// API helpers
async function deepResearch(query, onStage) {
  onStage("planning", "Submitting query to agent…");
  const res = await api.post("/deep-research", { query });
  onStage("finalizing", "Deep research complete");
  return res;
}

async function imageGen(prompt, files) {
  const form = new FormData();
  form.append("prompt", prompt);
  files.forEach((f) => form.append("files", f));
  const headers = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;
  const url = `${API_BASE_URL.replace(/\/$/, "")}/image-gen`;
  const res = await fetch(url, { method: "POST", headers, body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Image generation failed");
  }
  return data.images || [];
}

// ------------------------------
// UI Components
// ------------------------------

function Card({ children, className }) {
  return (
    <div className={classNames("rounded-2xl border border-neutral-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
    </div>
  );
}

function Toasts() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    if (!state.toasts.length) return;
    const timers = state.toasts.map((t) => setTimeout(() => dispatch({ type: "REMOVE_TOAST", id: t.id }), 4000));
    return () => timers.forEach(clearTimeout);
  }, [state.toasts, dispatch]);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {state.toasts.map((t) => (
        <div
          key={t.id}
          className={classNames(
            "rounded-xl border p-3 shadow-md backdrop-blur",
            t.kind === "error" && "border-red-300 bg-red-50",
            t.kind === "success" && "border-emerald-300 bg-emerald-50",
            (!t.kind || t.kind === "info") && "border-neutral-300 bg-white/90"
          )}
        >
          <div className="text-sm font-medium text-neutral-900">{t.title}</div>
          {t.desc && <div className="text-xs text-neutral-600">{t.desc}</div>}
        </div>
      ))}
    </div>
  );
}

function ModeSelector({ mode, onChange }) {
  const groupId = useId();
  const options = [
    { id: "chat", label: "Chat" },
    { id: "deep", label: "Deep research", desc: "Web + multi-step agent" },
    { id: "image", label: "Create image" },
    { id: "connectors", label: "Connectors" },
  ];

  function handleKeyDown(e) {
    const idx = options.findIndex((o) => o.id === mode);
    const next = (delta) => options[(idx + delta + options.length) % options.length].id;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      onChange(next(+1));
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      onChange(next(-1));
      e.preventDefault();
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={groupId}
      className="inline-flex gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-1"
      onKeyDown={handleKeyDown}
    >
      <span id={groupId} className="sr-only">
        Response mode
      </span>
      {options.map((opt) => (
        <button
          key={opt.id}
          role="radio"
          aria-checked={mode === opt.id}
          onClick={() => onChange(opt.id)}
          className={classNames(
            "group rounded-xl px-3 py-2 text-left outline-none transition",
            mode === opt.id ? "bg-white shadow-sm ring-1 ring-neutral-200" : "hover:bg-white"
          )}
        >
          <span className="block text-sm font-medium text-neutral-900">{opt.label}</span>
          {opt.desc && (
            <span className="block text-xs text-neutral-500 group-aria-checked:text-neutral-700">
              {opt.desc}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const PLACEHOLDER = {
  chat: "Ask anything…",
  deep: "Ask a complex question for deep research (will consult the web)…",
  image: "Describe the image you want to create…",
  connectors: "Ask using selected sources (e.g., Drive, GitHub)…",
};

function FileChips() {
  const { state, dispatch } = useStore();
  if (!state.files.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {state.files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
          <span className="truncate max-w-[220px]" title={`${f.name} (${Math.round(f.size / 1024)} KB)`}>
            {f.name}
          </span>
          <button
            className="rounded-full border px-2 py-0.5 text-xs hover:bg-neutral-100"
            onClick={() => dispatch({ type: "REMOVE_FILE", index: i })}
            aria-label={`Remove ${f.name}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function ActionTray() {
  const { state, dispatch } = useStore();
  const inputRef = useRef(null);
  const accept = state.mode === "image" ? "image/*" : ".pdf,.csv,.xlsx,image/*,.txt";

  function onFilesSelected(fs) {
    if (!fs.length) return;
    const maxMB = 25;
    const bad = fs.find((f) => f.size > maxMB * 1024 * 1024);
    if (bad) {
      dispatch({ type: "ADD_TOAST", toast: { id: uid("toast"), title: "File too large", desc: `${bad.name} exceeds ${maxMB}MB`, kind: "error" } });
      return;
    }
    dispatch({ type: "ADD_FILES", files: fs });
    dispatch({ type: "ADD_TOAST", toast: { id: uid("toast"), title: `${fs.length} file(s) added`, kind: "success" } });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept={accept}
          onChange={(e) => onFilesSelected(Array.from(e.target.files || []))}
        />
        + Add photos/files
      </label>

      <button
        onClick={() => dispatch({ type: "OPEN_CONNECTORS", open: true })}
        className={classNames(
          "rounded-xl border px-3 py-2 text-sm",
          state.mode !== "connectors" && "opacity-50 hover:opacity-70"
        )}
        aria-disabled={state.mode !== "connectors"}
      >
        Choose sources
      </button>

      <div className="relative">
        <MoreMenu />
      </div>
    </div>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
      >
        More ▾
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-56 rounded-xl border bg-white p-1 shadow-lg">
          {[
            { id: "voice", label: "Start voice / record" },
            { id: "templates", label: "Prompt templates" },
            { id: "tools", label: "Tools gallery" },
          ].map((it) => (
            <button
              key={it.id}
              role="menuitem"
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50"
              onClick={() => setOpen(false)}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorsModal() {
  const { state, dispatch } = useStore();
  const items = [
    { id: "google-drive", label: "Google Drive", desc: "Pick files/folders to search" },
    { id: "github", label: "GitHub", desc: "Repos, issues, PRs" },
    { id: "sharepoint", label: "SharePoint", desc: "Sites & document libraries" },
    { id: "box", label: "Box", desc: "Cloud files & folders" },
  ];
  if (!state.connectorsOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-lg p-4">
        <div className="mb-3 flex items-start justify-between">
          <SectionTitle title="Choose data sources" subtitle="Only used in this thread" />
          <button
            className="rounded-lg border px-3 py-1 text-sm hover:bg-neutral-50"
            onClick={() => dispatch({ type: "OPEN_CONNECTORS", open: false })}
          >
            Close
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((it) => {
            const checked = state.selectedConnectors.has(it.id);
            return (
              <label
                key={it.id}
                className={classNames(
                  "flex cursor-pointer items-center justify-between rounded-xl border p-3 hover:bg-neutral-50",
                  checked && "ring-1 ring-neutral-300"
                )}
              >
                <div>
                  <div className="text-sm font-medium text-neutral-900">{it.label}</div>
                  <div className="text-xs text-neutral-600">{it.desc}</div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={() => dispatch({ type: "TOGGLE_CONNECTOR", id: it.id })}
                  aria-label={`Toggle ${it.label}`}
                />
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-neutral-600">
            Selected: {state.selectedConnectors.size || 0}
          </div>
          <button
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
            onClick={async () => {
              try {
                await api.post("/connectors/tokens", {
                  connectors: Array.from(state.selectedConnectors),
                });
                dispatch({ type: "OPEN_CONNECTORS", open: false });
                dispatch({
                  type: "ADD_TOAST",
                  toast: {
                    id: uid("toast"),
                    title: "Sources updated",
                    desc: `${state.selectedConnectors.size} connector(s) selected`,
                    kind: "success",
                  },
                });
              } catch (err) {
                dispatch({
                  type: "ADD_TOAST",
                  toast: { id: uid("toast"), title: "Failed to update sources", kind: "error" },
                });
              }
            }}
          >
            Use in this chat
          </button>
        </div>
      </Card>
    </div>
  );
}

function DeepProgressBanner() {
  const { state, dispatch } = useStore();
  if (!state.deepProgress.running) return null;
  const stages = [
    { id: "planning", label: "Planning" },
    { id: "searching", label: "Searching" },
    { id: "synthesizing", label: "Synthesizing" },
    { id: "finalizing", label: "Finalizing" },
  ];
  return (
    <Card className="mb-3 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
          <div className="text-sm font-medium text-neutral-900">Deep research in progress…</div>
        </div>
        <button
          className="rounded-lg border px-3 py-1 text-sm hover:bg-neutral-50"
          onClick={() => {
            dispatch({ type: "DEEP_STOP" });
            dispatch({ type: "ADD_TOAST", toast: { id: uid("toast"), title: "Research canceled", kind: "info" } });
          }}
        >
          Cancel
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {stages.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-xs">
            <div className={classNames(
              "h-2 w-2 rounded-full",
              state.deepProgress.stage === s.id ? "bg-neutral-900" : "bg-neutral-300"
            )} />
            <span className={classNames(
              state.deepProgress.stage === s.id ? "text-neutral-900" : "text-neutral-500"
            )}>{s.label}</span>
          </div>
        ))}
      </div>
      {state.deepProgress.log.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-neutral-600">
          {state.deepProgress.log.slice(-3).map((l, i) => (
            <div key={i}>• {l}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ResultsPanel() {
  const { state } = useStore();
  if (!state.results.text && !state.results.images?.length) return null;
  return (
    <Card className="p-4">
      <SectionTitle title="Results" />
      {state.results.text && (
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm text-neutral-800">
          {state.results.text}
        </pre>
      )}
      {state.results.citations && state.results.citations.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          <div className="text-neutral-900">Citations</div>
          <ul className="list-inside list-disc text-neutral-700">
            {state.results.citations.map((c, i) => (
              <li key={`${c.url}-${i}`}>
                <a className="underline hover:no-underline" href={c.url} target="_blank" rel="noreferrer">
                  {c.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.results.images && state.results.images.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.results.images.map((src, i) => (
            <img key={i} src={src} alt={`Generated ${i + 1}`} className="w-full rounded-xl border" />
          ))}
        </div>
      )}
    </Card>
  );
}

function ChatComposer() {
  const { state, dispatch } = useStore();
  const [value, setValue] = useState("");
  const submittingRef = useRef(false);

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    dispatch({ type: "RESET_RESULTS" });

    const q = value.trim();
    if (!q) {
      dispatch({ type: "ADD_TOAST", toast: { id: uid("toast"), title: "Type something to send", kind: "info" } });
      submittingRef.current = false;
      return;
    }

    try {
      if (state.mode === "chat") {
        dispatch({ type: "SET_RESULTS", results: { text: `You said: ${q}\n\n(Connect your backend to replace this mock.)` } });
      } else if (state.mode === "deep") {
        dispatch({ type: "DEEP_START" });
        const res = await deepResearch(q, (stage, log) => {
          dispatch({ type: "DEEP_SET_STAGE", stage, log });
        });
        dispatch({ type: "SET_RESULTS", results: { text: res.text, citations: res.citations } });
        dispatch({ type: "DEEP_STOP" });
      } else if (state.mode === "image") {
        const images = await imageGen(q, state.files);
        dispatch({ type: "SET_RESULTS", results: { images } });
        dispatch({ type: "ADD_TOAST", toast: { id: uid("toast"), title: "Images ready", kind: "success" } });
      } else if (state.mode === "connectors") {
        if (state.selectedConnectors.size === 0) {
          dispatch({ type: "ADD_TOAST", toast: { id: uid("toast"), title: "Select sources first", desc: "Open Connectors to choose data.", kind: "error" } });
        } else {
          const res = await api.post("/connectors/query", {
            query: q,
            connectors: Array.from(state.selectedConnectors),
          });
          dispatch({ type: "SET_RESULTS", results: { text: res.text, citations: res.citations } });
        }
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle title="Compose" subtitle="Choose a mode, attach context, and send" />
          <ModeSelector mode={state.mode} onChange={(m) => dispatch({ type: "SET_MODE", mode: m })} />
        </div>

        <ActionTray />
        <FileChips />

        <textarea
          className="mt-2 h-28 w-full resize-y rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900"
          placeholder={PLACEHOLDER[state.mode]}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-500">Press Enter to submit • Shift+Enter for new line</div>
          <button
            onClick={handleSubmit}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
          >
            Send
          </button>
        </div>
      </div>
    </Card>
  );
}

function ChatWorkbench() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <DeepProgressBanner />
      <ChatComposer />
      <div className="mt-3" />
      <ResultsPanel />
      <ConnectorsModal />
      <Toasts />
    </div>
  );
}

export default function DemoApp() {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-neutral-100">
        <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-neutral-900" />
              <span className="text-sm font-semibold tracking-tight text-neutral-900">Mode Selector Demo</span>
            </div>
            <nav className="text-xs text-neutral-500">Accessible • Tailwind • No external state</nav>
          </div>
        </header>
        <main>
          <ChatWorkbench />
        </main>
        <footer className="mt-10 border-t bg-white/60">
          <div className="mx-auto max-w-4xl p-4 text-center text-xs text-neutral-500">
            Replace mocks with your real endpoints. This component set focuses on UI/UX, accessibility, and clean state flow.
          </div>
        </footer>
      </div>
    </StoreProvider>
  );
}

