import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '../context/EditorContext.jsx';
import { renderFrame } from '../utils/canvasRenderer.js';

const CANVAS_W = 360;
const CANVAS_H = 640;

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getCanvasPct(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
  };
}

function hitTest(pctX, pctY, state) {
  // image overlay (check bounds first)
  const img = state.imageOverlay;
  if (img.enabled && img.visible && img.imgElement) {
    const halfW = img.widthPct / 2;
    const halfH = (img.widthPct * img.imgElement.naturalHeight / img.imgElement.naturalWidth) / 2;
    if (Math.abs(pctX - img.x) <= halfW && Math.abs(pctY - img.y) <= halfH) {
      return 'image';
    }
  }
  // text overlays (hit zone ~10% wide, ~6% tall)
  const HX = 30, HY = 6;
  if (state.titleText.enabled && Math.abs(pctX - state.titleText.x) < HX && Math.abs(pctY - state.titleText.y) < HY) return 'title';
  if (state.username.enabled && state.username.visible && Math.abs(pctX - state.username.x) < HX && Math.abs(pctY - state.username.y) < HY) return 'username';
  if (state.aiGenerated.enabled && state.aiGenerated.visible && Math.abs(pctX - state.aiGenerated.x) < HX && Math.abs(pctY - state.aiGenerated.y) < HY) return 'aiGenerated';
  return null;
}

export default function CenterPanel() {
  const {
    state, selectedVideo, updateVideo,
    updateTitle, updateImageOverlay, updateUsername, updateAiGenerated,
  } = useEditor();

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animRef = useRef(null);
  const dragRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTarget, setHoverTarget] = useState(null);

  // Init hidden video element
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    videoRef.current = video;
    video.addEventListener('timeupdate', () => setCurrentTime(video.currentTime));
    video.addEventListener('play', () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));
    video.addEventListener('ended', () => { setIsPlaying(false); });
    return () => { video.src = ''; };
  }, []);

  // Load video on selection change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!selectedVideo) { video.src = ''; video.load(); return; }

    video.src = selectedVideo.url;
    video.load();

    const onMeta = () => {
      const duration = video.duration;
      updateVideo(selectedVideo.id, {
        duration,
        trim: { start: selectedVideo.trim.start || 0, end: selectedVideo.trim.end > 0 ? selectedVideo.trim.end : duration },
      });
      video.currentTime = selectedVideo.trim.start || 0;
    };
    video.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => video.removeEventListener('loadedmetadata', onMeta);
  }, [selectedVideo?.id]);

  // Canvas render loop — closure over latest state/selectedVideo
  const stateRef = useRef(state);
  const selectedVideoRef = useRef(selectedVideo);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { selectedVideoRef.current = selectedVideo; }, [selectedVideo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    function loop() {
      renderFrame(ctx, CANVAS_W, CANVAS_H, videoRef.current, selectedVideoRef.current, stateRef.current);
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []); // single loop — reads from refs each frame

  // Enforce trim
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedVideo) return;
    function checkTrim() {
      const end = selectedVideo.trim.end;
      if (end > 0 && video.currentTime >= end) {
        video.pause();
        video.currentTime = selectedVideo.trim.start || 0;
      }
    }
    video.addEventListener('timeupdate', checkTrim);
    return () => video.removeEventListener('timeupdate', checkTrim);
  }, [selectedVideo?.trim]);

  // ── drag-and-drop on canvas ──────────────────────────────────────────────

  const updatePos = useCallback((type, x, y) => {
    if (type === 'title') updateTitle({ x, y });
    else if (type === 'username') updateUsername({ x, y });
    else if (type === 'aiGenerated') updateAiGenerated({ x, y });
    else if (type === 'image') updateImageOverlay({ x, y });
  }, [updateTitle, updateUsername, updateAiGenerated, updateImageOverlay]);

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPct(canvas, e.clientX, e.clientY);
    const target = hitTest(x, y, stateRef.current);
    if (!target) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const cur = stateRef.current;
    const orig = target === 'title' ? { x: cur.titleText.x, y: cur.titleText.y }
      : target === 'username' ? { x: cur.username.x, y: cur.username.y }
      : target === 'aiGenerated' ? { x: cur.aiGenerated.x, y: cur.aiGenerated.y }
      : { x: cur.imageOverlay.x, y: cur.imageOverlay.y };
    dragRef.current = { type: target, startX: x, startY: y, origX: orig.x, origY: orig.y };
  }, []);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPct(canvas, e.clientX, e.clientY);
    if (dragRef.current) {
      const d = dragRef.current;
      const nx = Math.max(0, Math.min(100, d.origX + (x - d.startX)));
      const ny = Math.max(0, Math.min(100, d.origY + (y - d.startY)));
      updatePos(d.type, nx, ny);
    } else {
      setHoverTarget(hitTest(x, y, stateRef.current));
    }
  }, [updatePos]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── playback ────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (selectedVideoRef.current?.trim.end > 0 && video.currentTime >= selectedVideoRef.current.trim.end) {
        video.currentTime = selectedVideoRef.current.trim.start || 0;
      }
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((e) => {
    const video = videoRef.current;
    const sv = selectedVideoRef.current;
    if (!video || !sv) return;
    const pct = parseFloat(e.target.value);
    const start = sv.trim.start || 0;
    const end = sv.trim.end || sv.duration;
    video.currentTime = start + ((end - start) * pct) / 100;
  }, []);

  const trimStart = selectedVideo?.trim.start || 0;
  const trimEnd = selectedVideo?.trim.end || selectedVideo?.duration || 0;
  const trimDuration = Math.max(0, trimEnd - trimStart);
  const progress = trimDuration > 0 ? (Math.max(0, currentTime - trimStart) / trimDuration) * 100 : 0;

  const cursor = dragRef.current ? 'grabbing' : hoverTarget ? 'grab' : 'default';

  return (
    <div className="flex flex-col items-center gap-3 h-full">
      {/* Header */}
      <div className="w-full flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">ClipHook Studio</h1>
          <p className="text-xs text-gray-500">숏폼 편집 도구</p>
        </div>
        <span className="text-xs font-bold text-blue-400 bg-blue-950 border border-blue-800 px-3 py-1.5 rounded-full">
          9:16 · 1080×1920
        </span>
      </div>

      {/* Canvas frame */}
      <div className="relative flex-1 w-full flex items-center justify-center" style={{ minHeight: 0 }}>
        <div
          className="relative rounded-2xl border-4 border-[#1e1e2a] shadow-2xl overflow-hidden"
          style={{ aspectRatio: '9/16', height: 'min(100%, 600px)', maxHeight: '600px', background: '#080810' }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: '100%', height: '100%', display: 'block', cursor }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {!selectedVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 text-sm">영상을 업로드하세요</p>
            </div>
          )}

          {/* drag hint */}
          {(state.titleText.enabled || state.username.enabled || state.aiGenerated.enabled || state.imageOverlay.enabled) && (
            <div className="absolute top-2 left-2 bg-black/50 text-white/50 text-[9px] px-2 py-0.5 rounded-full pointer-events-none">
              텍스트/이미지 드래그 가능
            </div>
          )}

          <div className="absolute bottom-2 right-2 bg-black/50 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
            1080×1920
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="w-full flex-shrink-0 flex items-center gap-3 max-w-sm">
        <button
          onClick={togglePlay}
          disabled={!selectedVideo}
          className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
        >
          {isPlaying ? (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <input type="range" min="0" max="100" step="0.1"
          value={progress.toFixed(1)} onChange={handleSeek} disabled={!selectedVideo}
          className="flex-1 accent-blue-500 disabled:opacity-30" />
        <span className="text-xs text-gray-500 tabular-nums w-20 text-right flex-shrink-0">
          {formatTime(currentTime)} / {formatTime(trimEnd)}
        </span>
      </div>
    </div>
  );
}
