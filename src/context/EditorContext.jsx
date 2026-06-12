import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { defaultFontId } from '../config/fontConfig.js';

const initialState = {
  mediaItems: [],
  selectedVideoId: null,
  videoSettings: { x: 0, y: 0, fit: 'fill', scale: 100 },
  aspectRatio: { label: '9:16', w: 9, h: 16 },
  titleText: {
    enabled: true,
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
    enabled: true,
    text: '이 콘텐츠는 AI를 활용하여 제작되었습니다.',
    x: 50,
    y: 93,
    fontSize: 22,
    color: 'white',
    opacity: 0.85,
    visible: true,
  },
};

function makeVideoItem(file) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    type: 'video',
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    duration: 0,
    thumbnail: null,
  };
}

function makeImageItem(file) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    type: 'image',
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    duration: 3,
    imgElement: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_MEDIA_ITEMS': {
      const slots = 10 - state.mediaItems.length;
      const newItems = action.items.slice(0, slots);
      if (!newItems.length) return state;
      return {
        ...state,
        mediaItems: [...state.mediaItems, ...newItems],
        selectedVideoId: state.selectedVideoId || newItems[0].id,
      };
    }

    case 'REMOVE_MEDIA_ITEM': {
      const remaining = state.mediaItems.filter((v) => v.id !== action.id);
      const removed = state.mediaItems.find((v) => v.id === action.id);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      const newSelected =
        state.selectedVideoId === action.id ? (remaining[0]?.id || null) : state.selectedVideoId;
      return { ...state, mediaItems: remaining, selectedVideoId: newSelected };
    }

    case 'SELECT_VIDEO':
      return { ...state, selectedVideoId: action.id };

    case 'UPDATE_VIDEO':
      return {
        ...state,
        mediaItems: state.mediaItems.map((v) =>
          v.id === action.id ? { ...v, ...action.patch } : v,
        ),
      };

    case 'UPDATE_VIDEO_SETTINGS':
      return { ...state, videoSettings: { ...state.videoSettings, ...action.patch } };

    case 'SET_THUMBNAIL':
      return {
        ...state,
        mediaItems: state.mediaItems.map((v) =>
          v.id === action.id ? { ...v, thumbnail: action.thumbnail } : v,
        ),
      };

    case 'UPDATE_ASPECT_RATIO':
      return { ...state, aspectRatio: action.aspectRatio };

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

  const addVideos = useCallback((files) => {
    const items = Array.from(files).map(makeVideoItem);
    dispatch({ type: 'ADD_MEDIA_ITEMS', items });
  }, []);

  const addImages = useCallback((files) => {
    const items = Array.from(files).map(makeImageItem);
    dispatch({ type: 'ADD_MEDIA_ITEMS', items });
  }, []);

  const setThumbnail = useCallback(
    (id, thumbnail) => dispatch({ type: 'SET_THUMBNAIL', id, thumbnail }),
    [],
  );
  const removeVideo = useCallback((id) => dispatch({ type: 'REMOVE_MEDIA_ITEM', id }), []);
  const selectVideo = useCallback((id) => dispatch({ type: 'SELECT_VIDEO', id }), []);
  const updateVideo = useCallback((id, patch) => dispatch({ type: 'UPDATE_VIDEO', id, patch }), []);
  const updateVideoSettings = useCallback(
    (patch) => dispatch({ type: 'UPDATE_VIDEO_SETTINGS', patch }),
    [],
  );
  const updateAspectRatio = useCallback(
    (aspectRatio) => dispatch({ type: 'UPDATE_ASPECT_RATIO', aspectRatio }),
    [],
  );
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

  const selectedVideo = state.mediaItems.find((v) => v.id === state.selectedVideoId) || null;

  return (
    <EditorContext.Provider
      value={{
        state,
        selectedVideo,
        addVideos,
        addImages,
        setThumbnail,
        removeVideo,
        selectVideo,
        updateVideo,
        updateVideoSettings,
        updateAspectRatio,
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
