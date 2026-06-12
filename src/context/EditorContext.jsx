import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { defaultFontId } from '../config/fontConfig.js';

const initialState = {
  videos: [],
  selectedVideoId: null,
  titleText: {
    enabled: false,
    text: '제목을 입력하세요',
    x: 50,
    y: 6,
    fontSize: 42,
    color: 'white',
    bgColor: 'black',
    bgOpacity: 0.75,
    fontId: defaultFontId,
  },
  imageOverlay: {
    enabled: false,
    file: null,
    url: null,
    imgElement: null,
    x: 50,
    y: 50,
    widthPct: 30,
    opacity: 1.0,
    visible: true,
  },
  username: {
    enabled: true,
    text: '@Slime_TapTap',
    x: 50,
    y: 50,
    fontSize: 36,
    color: 'white',
    opacity: 1.0,
    visible: true,
  },
  aiGenerated: {
    enabled: false,
    text: 'AI 생성물',
    x: 50,
    y: 93,
    fontSize: 22,
    color: 'white',
    opacity: 0.85,
    visible: true,
  },
};

function makeVideo(file) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    duration: 0,
    thumbnail: null,
    displayScale: 100,
    trim: { start: 0, end: 0 },
    videoSettings: { x: 0, y: 0, fit: 'fill', scale: 100 },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_VIDEOS': {
      const slots = 10 - state.videos.length;
      const newVideos = action.files.slice(0, slots).map(makeVideo);
      if (!newVideos.length) return state;
      return {
        ...state,
        videos: [...state.videos, ...newVideos],
        selectedVideoId: state.selectedVideoId || newVideos[0].id,
      };
    }

    case 'REMOVE_VIDEO': {
      const remaining = state.videos.filter((v) => v.id !== action.id);
      URL.revokeObjectURL(state.videos.find((v) => v.id === action.id)?.url || '');
      const newSelected =
        state.selectedVideoId === action.id ? (remaining[0]?.id || null) : state.selectedVideoId;
      return { ...state, videos: remaining, selectedVideoId: newSelected };
    }

    case 'SELECT_VIDEO':
      return { ...state, selectedVideoId: action.id };

    case 'UPDATE_VIDEO':
      return {
        ...state,
        videos: state.videos.map((v) =>
          v.id === action.id ? { ...v, ...action.patch } : v,
        ),
      };

    case 'UPDATE_VIDEO_SETTINGS':
      return {
        ...state,
        videos: state.videos.map((v) =>
          v.id === action.id
            ? { ...v, videoSettings: { ...v.videoSettings, ...action.patch } }
            : v,
        ),
      };

    case 'SET_THUMBNAIL':
      return {
        ...state,
        videos: state.videos.map((v) =>
          v.id === action.id ? { ...v, thumbnail: action.thumbnail } : v,
        ),
      };

    case 'UPDATE_TRIM':
      return {
        ...state,
        videos: state.videos.map((v) =>
          v.id === action.id ? { ...v, trim: { ...v.trim, ...action.patch } } : v,
        ),
      };

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

  const addVideos = useCallback((files) => dispatch({ type: 'ADD_VIDEOS', files }), []);
  const setThumbnail = useCallback(
    (id, thumbnail) => dispatch({ type: 'SET_THUMBNAIL', id, thumbnail }),
    [],
  );
  const removeVideo = useCallback((id) => dispatch({ type: 'REMOVE_VIDEO', id }), []);
  const selectVideo = useCallback((id) => dispatch({ type: 'SELECT_VIDEO', id }), []);
  const updateVideo = useCallback((id, patch) => dispatch({ type: 'UPDATE_VIDEO', id, patch }), []);
  const updateVideoSettings = useCallback(
    (id, patch) => dispatch({ type: 'UPDATE_VIDEO_SETTINGS', id, patch }),
    [],
  );
  const updateTrim = useCallback((id, patch) => dispatch({ type: 'UPDATE_TRIM', id, patch }), []);
  const updateTitle = useCallback((patch) => dispatch({ type: 'UPDATE_TITLE', patch }), []);
  const updateImageOverlay = useCallback(
    (patch) => dispatch({ type: 'UPDATE_IMAGE_OVERLAY', patch }),
    [],
  );
  const updateUsername = useCallback((patch) => dispatch({ type: 'UPDATE_USERNAME', patch }), []);
  const updateAiGenerated = useCallback(
    (patch) => dispatch({ type: 'UPDATE_AI_GENERATED', patch }),
    [],
  );

  const selectedVideo = state.videos.find((v) => v.id === state.selectedVideoId) || null;

  return (
    <EditorContext.Provider
      value={{
        state,
        selectedVideo,
        addVideos,
        setThumbnail,
        removeVideo,
        selectVideo,
        updateVideo,
        updateVideoSettings,
        updateTrim,
        updateTitle,
        updateImageOverlay,
        updateUsername,
        updateAiGenerated,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
