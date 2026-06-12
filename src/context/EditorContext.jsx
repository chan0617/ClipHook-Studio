import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { defaultFontId } from '../config/fontConfig.js';
import { MAX_MEDIA_ITEMS } from '../config/constants.js';

const STORAGE_KEY = 'cliphook_settings_v3';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSettings(state) {
  try {
    const data = {
      aspectRatio: state.aspectRatio,
      globalVideoScale: state.globalVideoScale,
      globalVideoFit: state.globalVideoFit,
      globalVideoX: state.globalVideoX,
      globalVideoY: state.globalVideoY,
      repeatDuration: state.repeatDuration,
      exportSettings: state.exportSettings,
      titleText: state.titleText,
      username: { ...state.username },
      aiGenerated: { ...state.aiGenerated },
      imageOverlay: {
        ...state.imageOverlay,
        file: null, url: null, imgElement: null,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function defaultShadow() {
  return { enabled: false, color: '#000000', blur: 10, offsetX: 2, offsetY: 2 };
}

const s = loadSettings();

const initialState = {
  mediaItems: [],
  selectedItemId: null,
  aspectRatio: s.aspectRatio || '9:16',
  globalVideoScale: s.globalVideoScale ?? 100,
  globalVideoFit: s.globalVideoFit || 'fill',
  globalVideoX: s.globalVideoX ?? 0,
  globalVideoY: s.globalVideoY ?? 0,
  repeatDuration: s.repeatDuration ?? 0,
  exportSettings: s.exportSettings || { resolution: '1080p', fps: 30, format: 'mp4' },
  titleText: {
    enabled: true,
    text: '제목을 입력하세요',
    x: 50, y: 6,
    fontSize: 42,
    color: 'white',
    bgColor: 'black',
    bgOpacity: 0.75,
    fontId: defaultFontId,
    ...(s.titleText || {}),
  },
  imageOverlay: {
    enabled: false, file: null, url: null, imgElement: null,
    x: 50, y: 50, widthPct: 30, opacity: 1.0, visible: true,
    ...(s.imageOverlay ? { ...s.imageOverlay, file: null, url: null, imgElement: null } : {}),
  },
  username: {
    enabled: true,
    text: '@username',
    x: 50, y: 50,
    fontSize: 36,
    color: 'white',
    opacity: 1.0,
    visible: true,
    ...(s.username || {}),
    shadow: { ...defaultShadow(), ...(s.username?.shadow || {}) },
  },
  aiGenerated: {
    enabled: true,
    text: 'AI 생성물',
    x: 50, y: 93,
    fontSize: 22,
    color: 'white',
    opacity: 0.85,
    visible: true,
    ...(s.aiGenerated || {}),
    shadow: { ...defaultShadow(), ...(s.aiGenerated?.shadow || {}) },
  },
};

export function makeVideoItem(file, convertedUrl = null) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    url: convertedUrl || URL.createObjectURL(file),
    name: file.name,
    type: 'video',
    duration: 0,
    trim: { start: 0, end: 0 },
    thumbnail: null,
    converting: false,
    conversionProgress: 0,
    conversionError: null,
  };
}

export function makeImageItem(file, imgElement = null) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    type: 'image',
    imgElement,
    imageDuration: 5,
    imageEndBehavior: 'hold',
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_MEDIA': {
      const slots = MAX_MEDIA_ITEMS - state.mediaItems.length;
      const toAdd = action.items.slice(0, slots);
      if (!toAdd.length) return state;
      return {
        ...state,
        mediaItems: [...state.mediaItems, ...toAdd],
        selectedItemId: state.selectedItemId || toAdd[0].id,
      };
    }

    case 'REMOVE_MEDIA': {
      const item = state.mediaItems.find(v => v.id === action.id);
      if (item?.url) {
        try { URL.revokeObjectURL(item.url); } catch {}
      }
      const remaining = state.mediaItems.filter(v => v.id !== action.id);
      const newSelected =
        state.selectedItemId === action.id
          ? (remaining[0]?.id || null)
          : state.selectedItemId;
      return { ...state, mediaItems: remaining, selectedItemId: newSelected };
    }

    case 'SELECT_ITEM':
      return { ...state, selectedItemId: action.id };

    case 'UPDATE_MEDIA':
      return {
        ...state,
        mediaItems: state.mediaItems.map(v =>
          v.id === action.id ? { ...v, ...action.patch } : v
        ),
      };

    case 'MOVE_UP': {
      const idx = state.mediaItems.findIndex(v => v.id === action.id);
      if (idx <= 0) return state;
      const items = [...state.mediaItems];
      [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
      return { ...state, mediaItems: items };
    }

    case 'MOVE_DOWN': {
      const idx = state.mediaItems.findIndex(v => v.id === action.id);
      if (idx < 0 || idx >= state.mediaItems.length - 1) return state;
      const items = [...state.mediaItems];
      [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
      return { ...state, mediaItems: items };
    }

    case 'REORDER':
      return { ...state, mediaItems: action.items };

    case 'UPDATE_TRIM':
      return {
        ...state,
        mediaItems: state.mediaItems.map(v =>
          v.id === action.id ? { ...v, trim: { ...v.trim, ...action.patch } } : v
        ),
      };

    case 'SET_ASPECT_RATIO':
      return { ...state, aspectRatio: action.value };

    case 'SET_GLOBAL_VIDEO':
      return { ...state, ...action.patch };

    case 'SET_REPEAT_DURATION':
      return { ...state, repeatDuration: action.value };

    case 'SET_EXPORT_SETTINGS':
      return { ...state, exportSettings: { ...state.exportSettings, ...action.patch } };

    case 'UPDATE_TITLE':
      return { ...state, titleText: { ...state.titleText, ...action.patch } };

    case 'UPDATE_IMAGE_OVERLAY':
      return { ...state, imageOverlay: { ...state.imageOverlay, ...action.patch } };

    case 'UPDATE_USERNAME':
      return { ...state, username: { ...state.username, ...action.patch } };

    case 'UPDATE_AI_GENERATED':
      return { ...state, aiGenerated: { ...state.aiGenerated, ...action.patch } };

    default:
      return state;
  }
}

const EditorContext = createContext(null);

export function EditorProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    saveSettings(state);
  }, [
    state.aspectRatio, state.globalVideoScale, state.globalVideoFit,
    state.globalVideoX, state.globalVideoY, state.repeatDuration,
    state.exportSettings, state.titleText, state.imageOverlay,
    state.username, state.aiGenerated,
  ]);

  const addMedia         = useCallback((items) => dispatch({ type: 'ADD_MEDIA', items }), []);
  const removeMedia      = useCallback((id) => dispatch({ type: 'REMOVE_MEDIA', id }), []);
  const selectItem       = useCallback((id) => dispatch({ type: 'SELECT_ITEM', id }), []);
  const updateMedia      = useCallback((id, patch) => dispatch({ type: 'UPDATE_MEDIA', id, patch }), []);
  const moveUp           = useCallback((id) => dispatch({ type: 'MOVE_UP', id }), []);
  const moveDown         = useCallback((id) => dispatch({ type: 'MOVE_DOWN', id }), []);
  const reorder          = useCallback((items) => dispatch({ type: 'REORDER', items }), []);
  const updateTrim       = useCallback((id, patch) => dispatch({ type: 'UPDATE_TRIM', id, patch }), []);
  const setAspectRatio   = useCallback((value) => dispatch({ type: 'SET_ASPECT_RATIO', value }), []);
  const setGlobalVideo   = useCallback((patch) => dispatch({ type: 'SET_GLOBAL_VIDEO', patch }), []);
  const setRepeatDuration = useCallback((value) => dispatch({ type: 'SET_REPEAT_DURATION', value }), []);
  const setExportSettings = useCallback((patch) => dispatch({ type: 'SET_EXPORT_SETTINGS', patch }), []);
  const updateTitle       = useCallback((patch) => dispatch({ type: 'UPDATE_TITLE', patch }), []);
  const updateImageOverlay = useCallback((patch) => dispatch({ type: 'UPDATE_IMAGE_OVERLAY', patch }), []);
  const updateUsername    = useCallback((patch) => dispatch({ type: 'UPDATE_USERNAME', patch }), []);
  const updateAiGenerated = useCallback((patch) => dispatch({ type: 'UPDATE_AI_GENERATED', patch }), []);

  const selectedItem = state.mediaItems.find(v => v.id === state.selectedItemId) || null;

  return (
    <EditorContext.Provider value={{
      state, selectedItem,
      addMedia, removeMedia, selectItem, updateMedia,
      moveUp, moveDown, reorder,
      updateTrim,
      setAspectRatio, setGlobalVideo, setRepeatDuration, setExportSettings,
      updateTitle, updateImageOverlay, updateUsername, updateAiGenerated,
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
