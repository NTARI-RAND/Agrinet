export const initialState = {
  mode: 'chat',
  files: [],
  connectorsOpen: false,
  selectedConnectors: new Set(),
  toasts: [],
  deepProgress: { running: false, stage: 'idle', log: [] },
  results: {},
};

const handlers = {
  SET_MODE: (state, action) => ({ ...state, mode: action.mode }),
  ADD_FILES(state, action) {
    const files = [...state.files];
    for (const file of action.files) {
      if (!files.some((entry) =>
        entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified
      )) files.push(file);
    }
    return { ...state, files };
  },
  REMOVE_FILE(state, action) {
    const files = [...state.files];
    files.splice(action.index, 1);
    return { ...state, files };
  },
  OPEN_CONNECTORS: (state, action) => ({ ...state, connectorsOpen: action.open }),
  TOGGLE_CONNECTOR(state, action) {
    const selectedConnectors = new Set(state.selectedConnectors);
    if (selectedConnectors.has(action.id)) selectedConnectors.delete(action.id);
    else selectedConnectors.add(action.id);
    return { ...state, selectedConnectors };
  },
  ADD_TOAST: (state, action) => ({ ...state, toasts: [...state.toasts, action.toast] }),
  REMOVE_TOAST: (state, action) => ({
    ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id),
  }),
  DEEP_START: (state) => ({
    ...state, deepProgress: { running: true, stage: 'planning', startedAt: Date.now(), log: [] },
  }),
  DEEP_SET_STAGE: (state, action) => ({
    ...state,
    deepProgress: {
      ...state.deepProgress,
      stage: action.stage,
      log: action.log ? [...state.deepProgress.log, action.log] : [...state.deepProgress.log],
    },
  }),
  DEEP_STOP: (state) => ({ ...state, deepProgress: { running: false, stage: 'idle', log: [] } }),
  SET_RESULTS: (state, action) => ({ ...state, results: { ...state.results, ...action.results } }),
  RESET_RESULTS: (state) => ({ ...state, results: {} }),
};

export function reducer(state, action) {
  return Object.hasOwn(handlers, action.type) ? handlers[action.type](state, action) : state;
}
