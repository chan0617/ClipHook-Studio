import React, { useRef, useCallback, useEffect } from 'react';
import { useEditor } from '../context/EditorContext.jsx';

async function extractThumbnail(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    const capture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 160, 90);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
      video.src = '';
    };

    video.addEventListener('seeked', capture, { once: true });
    video.addEventListener(
      'loadedmetadata',
      () => { video.currentTime = Math.min(0.5, video.duration * 0.05); },
      { once: true },
    );
    video.addEventListener('error', () => resolve(null), { once: true });
    video.src = url;
    video.load();
  });
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LeftPanel() {
  const { state, selectedVideo, addVideos, setThumbnail, removeVideo, selectVideo, updateVideo } = useEditor();
  const inputRef = useRef(null);

  // Extract thumbnails for videos that don't have one yet
  useEffect(() => {
    for (const video of state.videos) {
      if (!video.thumbnail) {
        extractThumbnail(video.url).then((thumb) => {
          if (thumb) setThumbnail(video.id, thumb);
        });
      }
    }
  }, [state.videos.map((v) => v.id).join(','), setThumbnail]);

  const handleFiles = useCallback(
    (files) => {
      const mp4Files = Array.from(files).filter(
        (f) => f.type === 'video/mp4' || f.name.toLowerCase().endsWith('.mp4'),
      );
      if (!mp4Files.length) return;
      addVideos(mp4Files);
    },
    [addVideos],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = (e) => e.preventDefault();

  const isMax = state.videos.length >= 10;

  return (
    <aside className="flex flex-col gap-3 h-full overflow-hidden">
      {/* Upload area */}
      <div className="bg-[#1a1a22] rounded-xl p-3 border border-[#2a2a38]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-300">영상 업로드</h2>
          <span className="text-xs text-gray-500">{state.videos.length}/10</span>
        </div>
        <div
          onClick={() => !isMax && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`flex flex-col items-center justify-center gap-2 min-h-[100px] border-2 border-dashed rounded-xl transition-colors cursor-pointer
            ${isMax ? 'border-gray-700 opacity-40 cursor-not-allowed' : 'border-[#3b4068] hover:border-blue-500 hover:bg-[#1d1d2e]'}`}
        >
          <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-center text-gray-400">
            {isMax ? '최대 10개 도달' : 'MP4 드래그 또는 클릭'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,.mp4"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Video list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
        {state.videos.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-600 text-center">업로드된 영상이 없습니다</p>
          </div>
        )}
        {state.videos.map((video, idx) => (
          <VideoItem
            key={video.id}
            video={video}
            index={idx + 1}
            isSelected={video.id === selectedVideo?.id}
            onSelect={() => selectVideo(video.id)}
            onRemove={(e) => { e.stopPropagation(); removeVideo(video.id); }}
            onScaleChange={(scale) => updateVideo(video.id, { displayScale: scale })}
          />
        ))}
      </div>
    </aside>
  );
}

function VideoItem({ video, index, isSelected, onSelect, onRemove, onScaleChange }) {
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl border p-3 cursor-pointer transition-all
        ${isSelected
          ? 'border-blue-500 bg-[#1a2236]'
          : 'border-[#2a2a38] bg-[#1a1a22] hover:border-[#3a3a52]'
        }`}
    >
      <div className="flex items-start gap-2">
        {/* Thumbnail or index badge */}
        <div className="flex-shrink-0 relative w-14 h-10 rounded-lg overflow-hidden bg-[#111120] flex items-center justify-center">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt="thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-gray-500">{index}</span>
          )}
          <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-tl">
            {index}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate" title={video.name}>
            {video.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {video.duration > 0 ? formatTime(video.duration) : '로드 중…'}
            </span>
            {video.trim.end > 0 && video.trim.end !== video.duration && (
              <span className="text-xs text-blue-400">
                [{formatTime(video.trim.start)}–{formatTime(video.trim.end)}]
              </span>
            )}
          </div>

          {/* Display scale toggle */}
          <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-gray-600 mr-1">표시:</span>
            {[100, 120].map((s) => (
              <button
                key={s}
                onClick={() => onScaleChange(s)}
                className={`text-xs px-2 py-0.5 rounded-md transition-colors
                  ${video.displayScale === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#252535] text-gray-400 hover:bg-[#303048]'
                  }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Fit badge */}
      <div className="absolute top-2 right-7">
        <span className="text-xs text-gray-600">
          {video.videoSettings.fit === 'fill' ? '채우기' : video.videoSettings.fit === 'fit' ? '맞춤' : '원본'}
        </span>
      </div>
    </div>
  );
}
