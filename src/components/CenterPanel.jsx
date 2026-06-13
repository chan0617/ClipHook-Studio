import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '../context/EditorContext.jsx';
import { renderFrame } from '../utils/canvasRenderer.js';
import { ASPECT_RATIOS } from '../config/constants.js';

const PREVIEW_MAX_H = 600;

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getPreviewDimensions(aspectRatio) {
  const ar = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['9:16'];
  const ratio = ar.w / ar.h;
  if (ratio >= 1) {
    // wide: constrain by width
    const w = Math.min(PREVIEW_MAX_H * ratio, 400);
    const h = w / ratio;
    return { w: Math.round(w), h: Math.round(h) };
  } else {
    // tall: constrain by height
    const h = PREVIEW_MAX_H;
    const w = h * ratio;
    return { w: Math.round(w), h: Math.round(h) };
  }
}

export default function CenterPanel() {
  const {
    state, selectedItem,
    updateMedia, selectItem,
    updateTitle, updateImageOverlay, updateUsername, updateAiGenerated,
  } = useEditor();

  const { mediaItems, aspectRatio } = state;
  const { w: CANVAS_W, h: CANVAS_H } = getPreviewDimensions(aspectRatio);

  const canvasRef    = useRef(null);
  const videoRef     = useRef(null);
  const animRef      = useRef(null);
  const dragRef      = useRef(null);
  const stateRef     = useRef(state);
  const seqRef       = useRef({ index: 0, isPlaying: false, imageTimer: null });

  const [isPlaying,  setIsPlaying]  = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Sync previewIndex with selectedItemId
  useEffect(() => {
    if (!selectedItem) return;
    const idx = mediaItems.findIndex(v => v.id === selectedItem.id);
    if (idx >= 0 && idx !== previewIndex) {
      setPreviewIndex(idx);
    }
  }, [selectedItem?.id]);

  // Init video element
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    videoRef.current  = video;

    video.addEventListener('timeupdate', () => setCurrentTime(video.currentTime));
    video.addEventListener('play',  () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));
    video.addEventListener('ended', () => {
      setIsPlaying(false);
      // Auto-advance to next if sequence is playing
      if (seqRef.current.isPlaying) advanceSequence();
    });

    return () => { video.src = ''; };
  }, []);

  function advanceSequence() {
    const items  = stateRef.current.mediaItems;
    const curIdx = seqRef.current.index;
    const next   = (curIdx + 1) % items.length;
    seqRef.current.index = next;
    setPreviewIndex(next);
    selectItem(items[next]?.id);
    loadAndPlay(items[next]);
  }

  const loadAndPlay = useCallback((item) => {
    const video = videoRef.current;
    if (!item || !video) return;

    clearImageTimer();

    if (item.type === 'video') {
      video.src = item.url;
      video.load();
      video.addEventListener('loadedmetadata', () => {
        video.currentTime = item.trim?.start || 0;
        video.play().catch(() => {});
      }, { once: true });
    } else {
      // Image: just display, then auto-advance after duration
      video.pause();
      video.src = '';
      if (seqRef.current.isPlaying) {
        const dur = (item.imageDuration || 5) * 1000;
        seqRef.current.imageTimer = setTimeout(() => {
          if (seqRef.current.isPlaying) advanceSequence();
        }, dur);
      }
    }
  }, []);

  function clearImageTimer() {
    if (seqRef.current.imageTimer) {
      clearTimeout(seqRef.current.imageTimer);
      seqRef.current.imageTimer = null;
    }
  }

  // Load item when previewIndex changes OR when the item at that index is replaced
  useEffect(() => {
    const item = mediaItems[previewIndex];
    if (!item) return;

    const video = videoRef.current;
    if (!video) return;

    clearImageTimer();

    if (item.type === 'video') {
      const onMeta = () => {
        const dur = isFinite(video.duration) ? video.duration : 0;
        if (!item.duration || Math.abs(item.duration - dur) > 0.5) {
          updateMedia(item.id, {
            duration: dur,
            trim: { start: item.trim?.start || 0, end: item.trim?.end || dur },
          });
        }
        if (!seqRef.current.isPlaying) {
          video.currentTime = item.trim?.start || 0;
        }
      };

      // During auto-advance (isPlaying=true), loadAndPlay already set up the element.
      // Re-pausing/reloading here would break the play() chain.
      if (seqRef.current.isPlaying && video.src === item.url) {
        if (video.readyState >= 1) onMeta();
        else video.addEventListener('loadedmetadata', onMeta, { once: true });
      } else {
        video.pause();
        video.src = item.url;
        video.load();
        video.addEventListener('loadedmetadata', onMeta, { once: true });
      }
    } else {
      video.pause();
      video.src = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, mediaItems[previewIndex]?.id]);

  // Enforce trim
  useEffect(() => {
    const video = videoRef.current;
    const item  = mediaItems[previewIndex];
    if (!video || !item || item.type !== 'video') return;

    function checkTrim() {
      const end = item.trim?.end;
      if (end && end > 0 && video.currentTime >= end) {
        video.pause();
        video.currentTime = item.trim.start || 0;
        if (seqRef.current.isPlaying) advanceSequence();
      }
    }
    video.addEventListener('timeupdate', checkTrim);
    return () => video.removeEventListener('timeupdate', checkTrim);
  }, [previewIndex, mediaItems[previewIndex]?.trim]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function loop() {
      try {
        const items   = stateRef.current.mediaItems;
        const idx     = seqRef.current.index;
        const curItem = items[idx] || null;
        const mediaEl = (curItem?.type === 'video') ? videoRef.current : null;
        renderFrame(ctx, canvas.width, canvas.height, mediaEl, curItem, stateRef.current);
      } catch (e) {
        console.error('[canvas] renderFrame error:', e);
      }
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Sync seqRef.index with previewIndex
  useEffect(() => {
    seqRef.current.index = previewIndex;
  }, [previewIndex]);

  // ── drag canvas overlays ───────────────────────────────────────────────────

  function getCanvasPct(canvas, cx, cy) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((cx - rect.left) / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((cy - rect.top)  / rect.height) * 100)),
    };
  }

  function hitTest(px, py) {
    const s   = stateRef.current;
    const img = s.imageOverlay;
    if (img.enabled && img.visible && img.imgElement) {
      const hw = img.widthPct / 2;
      const hh = (img.widthPct * img.imgElement.naturalHeight / img.imgElement.naturalWidth) / 2;
      if (Math.abs(px - img.x) <= hw && Math.abs(py - img.y) <= hh) return 'image';
    }
    const HX = 30, HY = 7;
    if (s.titleText.enabled  && Math.abs(px - s.titleText.x)  < HX && Math.abs(py - s.titleText.y)  < HY) return 'title';
    if (s.username.enabled   && s.username.visible   && Math.abs(px - s.username.x)   < HX && Math.abs(py - s.username.y)   < HY) return 'username';
    if (s.aiGenerated.enabled && s.aiGenerated.visible && Math.abs(px - s.aiGenerated.x) < HX && Math.abs(py - s.aiGenerated.y) < HY) return 'aiGenerated';
    return null;
  }

  function updatePos(type, x, y) {
    if (type === 'title')       updateTitle({ x, y });
    else if (type === 'username')    updateUsername({ x, y });
    else if (type === 'aiGenerated') updateAiGenerated({ x, y });
    else if (type === 'image')       updateImageOverlay({ x, y });
  }

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPct(canvas, e.clientX, e.clientY);
    const target   = hitTest(x, y);
    if (!target) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const cur  = stateRef.current;
    const orig = target === 'title'       ? { x: cur.titleText.x,  y: cur.titleText.y  }
               : target === 'username'    ? { x: cur.username.x,   y: cur.username.y   }
               : target === 'aiGenerated' ? { x: cur.aiGenerated.x,y: cur.aiGenerated.y}
               :                           { x: cur.imageOverlay.x, y: cur.imageOverlay.y };
    dragRef.current = { type: target, startX: x, startY: y, origX: orig.x, origY: orig.y };
  }, []);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPct(canvas, e.clientX, e.clientY);
    if (dragRef.current) {
      const d  = dragRef.current;
      const nx = Math.max(0, Math.min(100, d.origX + (x - d.startX)));
      const ny = Math.max(0, Math.min(100, d.origY + (y - d.startY)));
      updatePos(d.type, nx, ny);
    } else {
      setHoverTarget(hitTest(x, y));
    }
  }, []);

  const handlePointerUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Playback controls ──────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    const item  = mediaItems[previewIndex];
    if (!item) return;

    if (item.type === 'image') {
      const nowPlaying = !seqRef.current.isPlaying;
      seqRef.current.isPlaying = nowPlaying;
      setIsPlaying(nowPlaying);
      if (nowPlaying) {
        const dur = (item.imageDuration || 5) * 1000;
        seqRef.current.imageTimer = setTimeout(() => {
          if (seqRef.current.isPlaying) advanceSequence();
        }, dur);
      } else {
        clearImageTimer();
      }
      return;
    }

    if (!video) return;

    if (video.paused) {
      const trimEnd = item.trim?.end;
      if (trimEnd && video.currentTime >= trimEnd) {
        video.currentTime = item.trim?.start || 0;
      }
      seqRef.current.isPlaying = true;
      video.play().catch(() => {});
    } else {
      seqRef.current.isPlaying = false;
      clearImageTimer();
      video.pause();
    }
  }, [previewIndex, mediaItems]);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    const item  = mediaItems[previewIndex];
    if (!video || !item || item.type !== 'video') return;
    const start = item.trim?.start || 0;
    const end   = item.trim?.end   || item.duration || 0;
    video.currentTime = Math.max(start, Math.min(end, video.currentTime + delta));
  }, [previewIndex, mediaItems]);

  const goToStart = useCallback(() => {
    const video = videoRef.current;
    const item  = mediaItems[previewIndex];
    if (!video || !item || item.type !== 'video') return;
    video.currentTime = item.trim?.start || 0;
  }, [previewIndex, mediaItems]);

  const goToNext = useCallback(() => {
    if (mediaItems.length < 2) return;
    const next = (previewIndex + 1) % mediaItems.length;
    setPreviewIndex(next);
    selectItem(mediaItems[next].id);
    seqRef.current.index = next;
  }, [previewIndex, mediaItems, selectItem]);

  const currentItem = mediaItems[previewIndex];
  const trimEnd     = currentItem?.type === 'video'
    ? (currentItem.trim?.end || currentItem.duration || 0)
    : 0;

  const cursor = dragRef.current ? 'grabbing' : hoverTarget ? 'grab' : 'default';

  const arLabel = ASPECT_RATIOS[aspectRatio]?.label || '';

  return (
    <div className="flex flex-col items-center gap-3 h-full">
      {/* Header */}
      <div className="w-full flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">ClipHook Studio</h1>
          <p className="text-xs text-gray-500">숏폼 편집 도구</p>
        </div>
        <span className="text-xs font-bold text-blue-400 bg-blue-950 border border-blue-800 px-3 py-1.5 rounded-full">
          {arLabel}
        </span>
      </div>

      {/* Canvas frame */}
      <div className="relative flex-1 w-full flex items-center justify-center" style={{ minHeight: 0 }}>
        <div
          className="relative rounded-2xl border-4 border-[#1e1e2a] shadow-2xl overflow-hidden flex items-center justify-center"
          style={{
            aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
            maxHeight:   PREVIEW_MAX_H,
            maxWidth:    `calc(${PREVIEW_MAX_H}px * ${CANVAS_W} / ${CANVAS_H})`,
            width:       '100%',
            background:  '#080810',
          }}
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

          {mediaItems.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 text-sm">미디어를 업로드하세요</p>
            </div>
          )}

          {currentItem?.type === 'image' && isPlaying && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-emerald-400 text-xs px-2 py-0.5 rounded-full pointer-events-none">
              이미지 재생 중…
            </div>
          )}

          {(state.titleText.enabled || state.username.enabled || state.aiGenerated.enabled || state.imageOverlay.enabled) && (
            <div className="absolute top-2 left-2 bg-black/50 text-white/50 text-[9px] px-2 py-0.5 rounded-full pointer-events-none">
              텍스트/이미지 드래그 가능
            </div>
          )}

          <div className="absolute top-2 right-2 bg-black/50 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
            {ASPECT_RATIOS[aspectRatio]?.w}×{ASPECT_RATIOS[aspectRatio]?.h}
          </div>
        </div>
      </div>

      {/* Playback controls — NO slider */}
      <div className="w-full flex-shrink-0 max-w-sm">
        {/* Time display */}
        <div className="flex justify-between text-xs text-gray-500 mb-2 px-1">
          <span>
            {currentItem
              ? `${currentItem.name} (${previewIndex + 1}/${mediaItems.length})`
              : '미디어 없음'}
          </span>
          <span className="tabular-nums">
            {currentItem?.type === 'video' ? `${formatTime(currentTime)} / ${formatTime(trimEnd)}` :
             currentItem?.type === 'image' ? `이미지 ${currentItem.imageDuration || 5}초` : ''}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-2">
          <CtrlBtn onClick={goToStart} title="처음으로" disabled={!currentItem || currentItem.type !== 'video'}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </CtrlBtn>

          <CtrlBtn onClick={() => seekBy(-5)} title="-5초" disabled={!currentItem || currentItem.type !== 'video'}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/>
            </svg>
          </CtrlBtn>

          <button
            onClick={togglePlay}
            disabled={!currentItem}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <CtrlBtn onClick={() => seekBy(5)} title="+5초" disabled={!currentItem || currentItem.type !== 'video'}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
            </svg>
          </CtrlBtn>

          <CtrlBtn onClick={goToNext} title="다음 미디어" disabled={mediaItems.length < 2}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zm2.5-6 8.5 6V6L8.5 12zM16 6h2v12h-2z"/>
            </svg>
          </CtrlBtn>
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({ onClick, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 rounded-lg bg-[#1e1e2c] border border-[#2a2a38] hover:border-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-400 hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}
