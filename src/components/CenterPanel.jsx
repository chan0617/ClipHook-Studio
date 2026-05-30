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

export default function CenterPanel() {
  const { state, selectedVideo, updateVideo } = useEditor();
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Init hidden video element
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    videoRef.current = video;

    video.addEventListener('timeupdate', () => setCurrentTime(video.currentTime));
    video.addEventListener('play', () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));
    video.addEventListener('ended', () => {
      setIsPlaying(false);
      if (selectedVideo) {
        video.currentTime = selectedVideo.trim.start || 0;
      }
    });

    return () => {
      video.src = '';
    };
  }, []);

  // Load video when selection changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!selectedVideo) {
      video.src = '';
      video.load();
      return;
    }

    video.src = selectedVideo.url;
    video.load();

    const onMeta = () => {
      const duration = video.duration;
      updateVideo(selectedVideo.id, {
        duration,
        trim: {
          start: selectedVideo.trim.start || 0,
          end: selectedVideo.trim.end > 0 ? selectedVideo.trim.end : duration,
        },
      });
      video.currentTime = selectedVideo.trim.start || 0;
    };

    video.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => video.removeEventListener('loadedmetadata', onMeta);
  }, [selectedVideo?.id]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function loop() {
      renderFrame(ctx, CANVAS_W, CANVAS_H, videoRef.current, selectedVideo, state);
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, selectedVideo]);

  // Enforce trim boundaries during playback
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

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (selectedVideo?.trim.end > 0 && video.currentTime >= selectedVideo.trim.end) {
        video.currentTime = selectedVideo.trim.start || 0;
      }
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [selectedVideo]);

  const handleSeek = useCallback(
    (e) => {
      const video = videoRef.current;
      if (!video || !selectedVideo) return;
      const pct = parseFloat(e.target.value);
      const start = selectedVideo.trim.start || 0;
      const end = selectedVideo.trim.end || selectedVideo.duration;
      video.currentTime = start + ((end - start) * pct) / 100;
    },
    [selectedVideo],
  );

  const trimStart = selectedVideo?.trim.start || 0;
  const trimEnd = selectedVideo?.trim.end || selectedVideo?.duration || 0;
  const trimDuration = Math.max(0, trimEnd - trimStart);
  const progress =
    trimDuration > 0 ? (Math.max(0, currentTime - trimStart) / trimDuration) * 100 : 0;

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
            9:16 &nbsp;·&nbsp; 1080×1920
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
          style={{
            aspectRatio: '9/16',
            height: 'min(100%, 640px)',
            maxHeight: '640px',
            background: '#080810',
          }}
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
              <p className="text-gray-600 text-sm">영상을 업로드하세요</p>
            </div>
          )}

          {/* Ratio badge */}
          <div className="absolute bottom-2 right-2 bg-black/50 text-white/70 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
            1080×1920
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="w-full max-w-xs flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!selectedVideo}
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
            value={progress.toFixed(1)}
            onChange={handleSeek}
            disabled={!selectedVideo}
            className="flex-1 accent-blue-500 disabled:opacity-30"
          />

          <span className="text-xs text-gray-500 tabular-nums w-20 text-right">
            {formatTime(currentTime)} / {formatTime(trimEnd)}
          </span>
        </div>
      </div>
    </div>
  );
}
