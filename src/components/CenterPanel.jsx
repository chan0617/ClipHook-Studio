import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '../context/EditorContext.jsx';
import { renderFrame } from '../utils/canvasRenderer.js';

const CANVAS_SIZES = {
  '9:16': { w: 360, h: 640 },
  '16:9': { w: 640, h: 360 },
  '1:1':  { w: 480, h: 480 },
};

const EXPORT_LABELS = {
  '9:16': '1080×1920',
  '16:9': '1920×1080',
  '1:1':  '1080×1080',
};

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CenterPanel() {
  const { state, selectedVideo, selectVideo, updateVideo } = useEditor();
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animRef = useRef(null);
  const videoCacheRef = useRef(new Map()); // preloaded video elements keyed by id
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const arLabel = state.aspectRatio?.label || '9:16';
  const canvasSize = CANVAS_SIZES[arLabel] || CANVAS_SIZES['9:16'];
  const CANVAS_W = canvasSize.w;
  const CANVAS_H = canvasSize.h;

  // Sync video preload cache with video media items
  useEffect(() => {
    const cache = videoCacheRef.current;
    const videoItems = state.mediaItems.filter((v) => v.type === 'video');
    const currentIds = new Set(videoItems.map((v) => v.id));

    // Remove elements for deleted videos
    for (const [id, el] of cache) {
      if (!currentIds.has(id)) {
        el.pause();
        el.src = '';
        cache.delete(id);
      }
    }

    // Preload new videos
    for (const v of videoItems) {
      if (!cache.has(v.id)) {
        const el = document.createElement('video');
        el.crossOrigin = 'anonymous';
        el.playsInline = true;
        el.preload = 'auto';
        el.src = v.url;
        el.load();
        cache.set(v.id, el);
      }
    }
  }, [state.mediaItems.map((v) => v.id).join(',')]);

  // Switch active video from preload cache when selection changes
  useEffect(() => {
    const cache = videoCacheRef.current;

    if (!selectedVideo || selectedVideo.type === 'image') {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    const el = cache.get(selectedVideo.id);
    if (!el) return;

    // Detach listeners from previous element
    if (videoRef.current && videoRef.current !== el) {
      videoRef.current.pause();
    }

    videoRef.current = el;
    setIsPlaying(!el.paused);
    setCurrentTime(el.currentTime);

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      // Auto-advance to next media item
      const idx = state.mediaItems.findIndex((v) => v.id === selectedVideo.id);
      if (idx >= 0 && idx < state.mediaItems.length - 1) {
        selectVideo(state.mediaItems[idx + 1].id);
      } else {
        el.currentTime = 0;
      }
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);

    const setupMeta = () => {
      const duration = el.duration;
      updateVideo(selectedVideo.id, { duration });
      el.currentTime = 0;
    };

    if (el.readyState >= 1) {
      setupMeta();
    } else {
      el.addEventListener('loadedmetadata', setupMeta, { once: true });
    }

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [selectedVideo?.id]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // For image items, pass the imgElement as the "video" element
    const mediaEl = selectedVideo?.type === 'image'
      ? selectedVideo.imgElement
      : videoRef.current;

    function loop() {
      renderFrame(ctx, CANVAS_W, CANVAS_H, mediaEl, selectedVideo, state);
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, selectedVideo, CANVAS_W, CANVAS_H]);

  const togglePlay = useCallback(() => {
    if (selectedVideo?.type === 'image') return; // images don't play
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.ended) video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [selectedVideo]);

  const handleSeek = useCallback(
    (e) => {
      const video = videoRef.current;
      if (!video || !selectedVideo || selectedVideo.type === 'image') return;
      const pct = parseFloat(e.target.value);
      const duration = selectedVideo.duration || 0;
      video.currentTime = (duration * pct) / 100;
    },
    [selectedVideo],
  );

  const duration = selectedVideo?.duration || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Aspect ratio for container style
  const arParts = arLabel.split(':');
  const arW = parseInt(arParts[0]);
  const arH = parseInt(arParts[1]);

  const containerStyle = {
    aspectRatio: `${arW}/${arH}`,
    background: '#080810',
  };

  // For 16:9 we limit height differently
  if (arLabel === '16:9') {
    containerStyle.width = 'min(100%, 640px)';
    containerStyle.maxWidth = '640px';
  } else if (arLabel === '1:1') {
    containerStyle.height = 'min(100%, 480px)';
    containerStyle.maxHeight = '480px';
  } else {
    // 9:16
    containerStyle.height = 'min(100%, 640px)';
    containerStyle.maxHeight = '640px';
  }

  const exportLabel = EXPORT_LABELS[arLabel] || '1080×1920';

  return (
    <div className="flex flex-col items-center gap-3 h-full">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">ClipHook Studio</h1>
          <p className="text-xs text-gray-500">숏폼 편집 도구</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-400 bg-blue-950 border border-blue-800 px-3 py-1.5 rounded-full">
            {arLabel} &nbsp;·&nbsp; {exportLabel}
          </span>
        </div>
      </div>

      {/* Canvas frame */}
      <div
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <div
          className="relative rounded-2xl overflow-hidden border-4 border-[#1e1e2a] shadow-2xl"
          style={containerStyle}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full h-full"
          />

          {!selectedVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg className="w-12 h-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 text-sm">미디어를 업로드하세요</p>
            </div>
          )}

          {/* Ratio badge */}
          <div className="absolute bottom-2 right-2 bg-black/50 text-white/70 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
            {exportLabel}
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="w-full max-w-xs flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!selectedVideo || selectedVideo.type === 'image'}
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={selectedVideo?.type === 'image' ? 0 : progress.toFixed(1)}
            onChange={handleSeek}
            disabled={!selectedVideo || selectedVideo.type === 'image'}
            className="flex-1 accent-blue-500 disabled:opacity-30"
          />

          <span className="text-xs text-gray-500 tabular-nums w-20 text-right">
            {selectedVideo?.type === 'image'
              ? `${selectedVideo.duration}s`
              : `${formatTime(currentTime)} / ${formatTime(duration)}`
            }
          </span>
        </div>
      </div>
    </div>
  );
}
