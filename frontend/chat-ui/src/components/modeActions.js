import api, { API_BASE_URL } from '../api';

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


function uid() {
  return `toast-${Math.random().toString(36).slice(2, 9)}`;
}

function describeError(error) {
  if (error instanceof Error && error.message) return error.message;
  return typeof error === 'string' && error.length ? error : 'Try again in a moment.';
}

async function research(state, query, dispatch) {
  dispatch({ type: 'DEEP_START' });
  try {
    const res = await deepResearch(query, (stage, log) => dispatch({ type: 'DEEP_SET_STAGE', stage, log }));
    dispatch({ type: 'SET_RESULTS', results: { text: res.text, citations: res.citations } });
  } catch (error) {
    console.error('Deep research request failed', error);
    dispatch({ type: 'ADD_TOAST', toast: {
      id: uid(), title: 'Deep research failed', desc: describeError(error), kind: 'error',
    } });
  } finally {
    dispatch({ type: 'DEEP_STOP' });
  }
}

const handlers = {
  chat(state, query, dispatch) {
    dispatch({ type: 'SET_RESULTS', results: {
      text: `You said: ${query}\n\n(Connect your backend to replace this mock.)`,
    } });
  },
  deep: research,
  async image(state, query, dispatch) {
    const images = await imageGen(query, state.files);
    dispatch({ type: 'SET_RESULTS', results: { images } });
    dispatch({ type: 'ADD_TOAST', toast: { id: uid(), title: 'Images ready', kind: 'success' } });
  },
  async connectors(state, query, dispatch) {
    if (state.selectedConnectors.size === 0) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: uid(), title: 'Select sources first', desc: 'Open Connectors to choose data.', kind: 'error',
      } });
      return;
    }
    const res = await api.post('/connectors/query', {
      query, connectors: Array.from(state.selectedConnectors),
    });
    dispatch({ type: 'SET_RESULTS', results: { text: res.text, citations: res.citations } });
  },
};

export async function submitMode(state, query, dispatch) {
  if (Object.hasOwn(handlers, state.mode)) await handlers[state.mode](state, query, dispatch);
}
