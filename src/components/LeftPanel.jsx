import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useEditor, makeVideoItem, makeImageItem } from '../context/EditorContext.jsx';
import { isVideoFile, isImageFile, needsConversion, MAX_MEDIA_ITEMS, MEMORY_WARNING_BYTES } from '../config/constants.js';
import { transcodeToMp4, canBrowserPlay } from '../utils/ffmpegHelper.js';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function extractThumbnail(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.addEventListener('loadeddata', () => {
      video.currentTime = 0.5;
    }, { once: true });

    video.addEventListener('seeked', () => {
      const c   = document.createElement('canvas');
      c.width   = 80;
      c.height  = Math.round(80 * (video.videoHeight / video.videoWidth));
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      video.src = '';
      resolve(c.toDataURL('image/jpeg', 0.7));
    }, { once: true });

    video.addEventListener('error', () => resolve(null), { once: true });
    setTimeout(() => { video.src = ''; resolve(null); }, 8000);

    video.src = url;
    video.load();
  });
}

export default function LeftPanel() {
  const {
    state, selectedItem,
    addMedia, removeMedia, selectItem, updateMedia, moveUp, moveDown, reorder,
  } = useEditor();

  const inputRef  = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragId,   setDragId]   = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const totalBytes = state.mediaItems.reduce((s, item) => s + (item.file?.size || 0), 0);
  const isMax      = state.mediaItems.length >= MAX_MEDIA_ITEMS;
  const memWarn    = totalBytes > MEMORY_WARNING_BYTES;

  const processFiles = useCallback(async (rawFiles) => {
    const files = Array.from(rawFiles).filter(f => isVideoFile(f) || isImageFile(f));
    if (!files.length) return;

    const slots = MAX_MEDIA_ITEMS - state.mediaItems.length;
    const toAdd = files.slice(0, slots);

    const newItems = [];

    for (const file of toAdd) {
      if (isImageFile(file)) {
        const url     = URL.createObjectURL(file);
        const imgEl   = new Image();
        await new Promise(res => {
          imgEl.onload  = res;
          imgEl.onerror = res;
          imgEl.src     = url;
        });
        newItems.push(makeImageItem(file, imgEl));
      } else {
        // Video
        const item = makeVideoItem(file);
        newItems.push(item);
      }
    }

    if (newItems.length) addMedia(newItems);

    // After adding, process thumbnails and conversion in the background
    for (const item of newItems) {
      if (item.type === 'video') {
        // Thumbnail extraction
        extractThumbnail(item.url).then(thumb => {
          updateMedia(item.id, { thumbnail: thumb });
        });

        // Load metadata
        loadVideoMeta(item.url).then(({ duration }) => {
          updateMedia(item.id, {
            duration,
            trim: { start: 0, end: duration },
          });
        });

        // MOV/M4V conversion if needed
        if (needsConversion(file)) {
          updateMedia(item.id, { converting: true, conversionProgress: 0 });

          const playable = await canBrowserPlay(item.url);
          if (!playable) {
            try {
              const mp4Blob = await transcodeToMp4(file, (pct) => {
                updateMedia(item.id, { conversionProgress: pct });
              });
              const mp4Url = URL.createObjectURL(mp4Blob);
              URL.revokeObjectURL(item.url);
              const { duration } = await loadVideoMeta(mp4Url);
              const thumb = await extractThumbnail(mp4Url);
              updateMedia(item.id, {
                url: mp4Url,
                converting: false,
                conversionProgress: 100,
                duration,
                trim: { start: 0, end: duration },
                thumbnail: thumb,
              });
            } catch (e) {
              updateMedia(item.id, {
                converting: false,
                conversionError: `변환 실패: ${e.message}`,
              });
            }
          } else {
            updateMedia(item.id, { converting: false });
          }
        }
      }
    }
  }, [state.mediaItems.length, addMedia, updateMedia]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // Drag-and-drop reorder
  const handleItemDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleItemDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };
  const handleItemDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const items    = [...state.mediaItems];
    const fromIdx  = items.findIndex(v => v.id === dragId);
    const toIdx    = items.findIndex(v => v.id === targetId);
    const [moved]  = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    reorder(items);
    setDragId(null);
    setDragOverId(null);
  };
  const handleItemDragEnd = () => { setDragId(null); setDragOverId(null); };

  return (
    <aside className="flex flex-col gap-3 h-full overflow-hidden">
      {/* Upload area */}
      <div className="bg-[#1a1a22] rounded-xl p-3 border border-[#2a2a38] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-300">미디어</h2>
          <span className={`text-xs ${isMax ? 'text-red-400' : 'text-gray-500'}`}>
            {state.mediaItems.length}/{MAX_MEDIA_ITEMS}
          </span>
        </div>

        <div
          onClick={() => !isMax && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex flex-col items-center justify-center gap-2 min-h-[90px] border-2 border-dashed rounded-xl transition-colors cursor-pointer select-none
            ${isMax
              ? 'border-gray-700 opacity-40 cursor-not-allowed'
              : dragOver
                ? 'border-blue-400 bg-blue-950/20'
                : 'border-[#3b4068] hover:border-blue-500 hover:bg-[#1d1d2e]'
            }`}
        >
          <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-center text-gray-400 px-2">
            {isMax ? `최대 ${MAX_MEDIA_ITEMS}개 도달` : 'MP4·MOV·WEBM·이미지\n드래그 또는 클릭'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            multiple
            className="hidden"
            onChange={(e) => processFiles(e.target.files)}
          />
        </div>

        {/* Memory warning */}
        {memWarn && (
          <div className="mt-2 flex items-start gap-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg px-2 py-1.5">
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <div className="text-xs text-amber-300">
              총 {formatBytes(totalBytes)} — 메모리 부족 가능
            </div>
          </div>
        )}

        {/* Total size info */}
        {totalBytes > 0 && !memWarn && (
          <p className="mt-1.5 text-xs text-gray-600 text-right">
            총 파일 크기: {formatBytes(totalBytes)}
          </p>
        )}
      </div>

      {/* Media list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0 pr-0.5">
        {state.mediaItems.length === 0 && (
          <div className="flex items-center justify-center h-24">
            <p className="text-xs text-gray-600 text-center">미디어를 업로드하세요</p>
          </div>
        )}

        {state.mediaItems.map((item, idx) => (
          <MediaItem
            key={item.id}
            item={item}
            index={idx + 1}
            isSelected={item.id === selectedItem?.id}
            isDragOver={dragOverId === item.id}
            canMoveUp={idx > 0}
            canMoveDown={idx < state.mediaItems.length - 1}
            onSelect={() => selectItem(item.id)}
            onRemove={(e) => { e.stopPropagation(); removeMedia(item.id); }}
            onMoveUp={(e) => { e.stopPropagation(); moveUp(item.id); }}
            onMoveDown={(e) => { e.stopPropagation(); moveDown(item.id); }}
            onDragStart={(e) => handleItemDragStart(e, item.id)}
            onDragOver={(e) => handleItemDragOver(e, item.id)}
            onDrop={(e) => handleItemDrop(e, item.id)}
            onDragEnd={handleItemDragEnd}
          />
        ))}
      </div>
    </aside>
  );
}

function MediaItem({
  item, index, isSelected, isDragOver,
  canMoveUp, canMoveDown,
  onSelect, onRemove, onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  const isVideo = item.type === 'video';
  const duration = isVideo
    ? (item.trim?.end && item.trim.end > 0 ? item.trim.end - (item.trim.start || 0) : item.duration)
    : item.imageDuration;

  return (
    <div
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative rounded-xl border p-2.5 cursor-pointer transition-all select-none
        ${isSelected ? 'border-blue-500 bg-[#1a2236]' : 'border-[#2a2a38] bg-[#1a1a22] hover:border-[#3a3a52]'}
        ${isDragOver ? 'border-blue-400 bg-blue-950/20' : ''}
      `}
    >
      <div className="flex items-start gap-2">
        {/* Thumbnail / icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[#111118] border border-[#2a2a38] flex items-center justify-center">
          {isVideo && item.thumbnail ? (
            <img src={item.thumbnail} className="w-full h-full object-cover" alt="" />
          ) : isVideo ? (
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          ) : item.url ? (
            <img src={item.url} className="w-full h-full object-cover" alt="" />
          ) : (
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-0.5">
          {/* Index + name */}
          <div className="flex items-center gap-1.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600/80 flex items-center justify-center text-[10px] font-bold text-white">
              {index}
            </span>
            <p className="text-xs font-medium text-gray-200 truncate" title={item.name}>
              {item.name}
            </p>
          </div>

          {/* Duration / status */}
          <div className="flex items-center gap-2 mt-1">
            {item.converting ? (
              <span className="text-xs text-amber-400 animate-pulse">
                변환 중… {item.conversionProgress}%
              </span>
            ) : item.conversionError ? (
              <span className="text-xs text-red-400 truncate" title={item.conversionError}>
                오류: {item.conversionError}
              </span>
            ) : (
              <>
                <span className={`text-xs px-1.5 py-0.5 rounded text-white
                  ${isVideo ? 'bg-blue-900/60' : 'bg-emerald-900/60'}`}>
                  {isVideo ? '영상' : '이미지'}
                </span>
                {duration > 0 && (
                  <span className="text-xs text-gray-500">{formatTime(duration)}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors rounded">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <button onClick={onMoveUp} disabled={!canMoveUp}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-400 disabled:opacity-20 transition-colors rounded">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/>
            </svg>
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-400 disabled:opacity-20 transition-colors rounded">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility: load video metadata
function loadVideoMeta(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.addEventListener('loadedmetadata', () => {
      const duration = isFinite(v.duration) ? v.duration : 0;
      v.src = '';
      resolve({ duration });
    }, { once: true });
    v.addEventListener('error', () => { v.src = ''; resolve({ duration: 0 }); }, { once: true });
    setTimeout(() => { v.src = ''; resolve({ duration: 0 }); }, 10_000);
    v.src = url;
    v.load();
  });
}
