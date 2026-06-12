import { renderFrame } from './canvasRenderer.js';
import { getExportDimensions } from '../config/constants.js';
import { getFFmpeg, safeDelete } from './ffmpegHelper.js';
import { fetchFile } from '@ffmpeg/util';

// ─── Cancel token ─────────────────────────────────────────────────────────────

export function createCancelToken() {
  let _cancelled = false;
  return {
    get cancelled() { return _cancelled; },
    cancel() { _cancelled = true; },
  };
}

// ─── Build sequence (handles repeat) ─────────────────────────────────────────

function getItemDuration(item) {
  if (item.type === 'video') {
    const end   = (item.trim?.end   || item.duration) || 0;
    const start = (item.trim?.start || 0);
    return Math.max(0, end - start);
  }
  return item.imageDuration || 5;
}

function getItemStart(item) {
  if (item.type === 'video') return item.trim?.start || 0;
  return 0;
}

function buildSequence(mediaItems, repeatDuration) {
  if (!repeatDuration || repeatDuration <= 0) {
    return mediaItems.map(item => ({
      item,
      startTime: getItemStart(item),
      duration:  getItemDuration(item),
    }));
  }

  const sequence = [];
  let totalTime  = 0;

  // safety guard for infinite loop
  let iterations = 0;
  const maxIter  = 10000;

  while (totalTime < repeatDuration && iterations < maxIter) {
    for (const item of mediaItems) {
      const dur       = getItemDuration(item);
      const remaining = repeatDuration - totalTime;
      const clip      = Math.min(dur, remaining);

      sequence.push({
        item,
        startTime: getItemStart(item),
        duration:  clip,
      });

      totalTime += clip;
      if (totalTime >= repeatDuration) break;
    }
    iterations++;
  }

  return sequence;
}

// ─── Main export entry ───────────────────────────────────────────────────────

export async function exportMedia(state, onProgress, onError, cancelToken = {}) {
  const { mediaItems, aspectRatio, repeatDuration, exportSettings } = state;

  if (!mediaItems.length) {
    onError({ code: 'NO_MEDIA', message: '내보낼 미디어가 없습니다.' });
    return;
  }

  const dims    = getExportDimensions(aspectRatio, exportSettings.resolution);
  const fps     = exportSettings.fps || 30;
  const sequence = buildSequence(mediaItems, repeatDuration);

  const hasImages = sequence.some(s => s.item.type === 'image');
  const useFFmpegConcat = repeatDuration > 0 && hasImages;

  try {
    if (useFFmpegConcat) {
      await exportWithFFmpegConcat(state, sequence, dims, fps, exportSettings, onProgress, onError, cancelToken);
    } else {
      await exportWithMediaRecorder(state, sequence, dims, fps, exportSettings, onProgress, onError, cancelToken);
    }
  } catch (err) {
    if (!cancelToken.cancelled) {
      onError({ code: 'EXPORT_FAILED', message: `내보내기 실패: ${err.message || String(err)}` });
    }
  }
}

// ─── MediaRecorder export ─────────────────────────────────────────────────────

async function exportWithMediaRecorder(state, sequence, dims, fps, exportSettings, onProgress, onError, cancelToken) {
  const { w: exportW, h: exportH } = dims;

  const canvas = document.createElement('canvas');
  canvas.width  = exportW;
  canvas.height = exportH;
  const ctx = canvas.getContext('2d');

  const mimeType = getSupportedMimeType(exportSettings.format);
  const stream   = canvas.captureStream(fps);

  let audioCtx, audioSource, audioDest, videoEl;

  try {
    audioCtx    = new AudioContext();
    audioDest   = audioCtx.createMediaStreamDestination();
    videoEl     = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.playsInline = true;
    audioSource = audioCtx.createMediaElementSource(videoEl);
    audioSource.connect(audioDest);
    audioSource.connect(audioCtx.destination);
  } catch {
    // Audio capture unavailable — continue without
  }

  const finalStream = audioDest
    ? new MediaStream([...stream.getVideoTracks(), ...audioDest.stream.getAudioTracks()])
    : stream;

  const recorder = new MediaRecorder(finalStream, {
    mimeType,
    videoBitsPerSecond: getBitrate(exportSettings.resolution),
  });

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };

  let recordingDone;
  let recordingError;
  const donePromise = new Promise((res, rej) => {
    recordingDone  = res;
    recordingError = rej;
  });

  recorder.onstop  = () => recordingDone(new Blob(chunks, { type: mimeType }));
  recorder.onerror = (e) => recordingError(new Error(e.error?.message || '녹화 오류'));

  recorder.start(200);

  const totalSegments = sequence.length;

  for (let i = 0; i < sequence.length; i++) {
    if (cancelToken.cancelled) break;

    const seg = sequence[i];
    onProgress({
      phase:   '렌더링 중',
      current: i + 1,
      total:   totalSegments,
      name:    seg.item.name,
      percent: Math.round(((i + 1) / totalSegments) * 100),
    });

    try {
      if (seg.item.type === 'video' && videoEl) {
        await renderVideoSegment(canvas, ctx, videoEl, seg, state, cancelToken);
      } else if (seg.item.type === 'image') {
        await renderImageSegment(canvas, ctx, seg, state, fps, cancelToken);
      }
    } catch (err) {
      recorder.stop();
      if (videoEl) videoEl.src = '';
      if (audioCtx) audioCtx.close();
      onError({
        code:    'SEGMENT_FAILED',
        message: `미디어 처리 실패: ${seg.item.name} — ${err.message}`,
        file:    seg.item.name,
      });
      return;
    }
  }

  recorder.stop();
  if (videoEl) videoEl.src = '';
  if (audioCtx) audioCtx.close();

  if (cancelToken.cancelled) return;

  const blob = await donePromise;
  triggerDownload(blob, mimeType);

  onProgress({ phase: '완료', percent: 100 });
}

// ─── Render one video segment (critical fix) ──────────────────────────────────

function renderVideoSegment(canvas, ctx, videoEl, seg, state, cancelToken) {
  return new Promise((resolve, reject) => {
    const { item, startTime, duration } = seg;
    const endTime = startTime + duration;

    let animId       = null;
    let renderActive = false;
    let errorFired   = false;

    function cleanup(err) {
      renderActive = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }

      // Remove all listeners to avoid double-fire
      videoEl.removeEventListener('playing', onPlaying);
      videoEl.removeEventListener('ended',   onEnded);
      videoEl.removeEventListener('error',   onError);

      videoEl.pause();

      if (err) reject(err);
      else     resolve();
    }

    function drawFrame() {
      if (!renderActive || cancelToken.cancelled) { cleanup(); return; }

      const t   = videoEl.currentTime;
      const end = videoEl.ended || t >= endTime - 0.04;

      renderFrame(ctx, canvas.width, canvas.height, videoEl, item, state);

      if (end) { cleanup(); return; }

      if ('requestVideoFrameCallback' in videoEl) {
        videoEl.requestVideoFrameCallback(drawFrame);
      } else {
        animId = requestAnimationFrame(drawFrame);
      }
    }

    function onPlaying() {
      if (renderActive) return;
      renderActive = true;
      if ('requestVideoFrameCallback' in videoEl) {
        videoEl.requestVideoFrameCallback(drawFrame);
      } else {
        animId = requestAnimationFrame(drawFrame);
      }
    }

    function onEnded() {
      renderFrame(ctx, canvas.width, canvas.height, videoEl, item, state);
      cleanup();
    }

    function onError(e) {
      if (errorFired) return;
      errorFired = true;
      cleanup(new Error(
        `영상 디코딩 실패: ${item.name} — ${e?.message || '알 수 없는 코덱 또는 파일 손상'}`
      ));
    }

    videoEl.addEventListener('playing', onPlaying, { once: true });
    videoEl.addEventListener('ended',   onEnded,   { once: true });
    videoEl.addEventListener('error',   onError,   { once: true });

    // Watchdog: if playing doesn't fire within 20 s → timeout
    const watchdog = setTimeout(() => {
      if (!renderActive) {
        cleanup(new Error(`영상 재생 타임아웃: ${item.name} — 파일이 손상되었거나 지원하지 않는 형식`));
      }
    }, 20_000);

    videoEl.addEventListener('playing', () => clearTimeout(watchdog), { once: true });

    function onSeeked() {
      videoEl.play().catch(err => {
        cleanup(new Error(`재생 시작 실패: ${item.name} — ${err.message}`));
      });
    }

    function onMeta() {
      const start = Math.max(0, startTime);
      if (Math.abs(videoEl.currentTime - start) > 0.15) {
        videoEl.addEventListener('seeked', onSeeked, { once: true });
        videoEl.currentTime = start;
      } else {
        onSeeked();
      }
    }

    videoEl.addEventListener('loadedmetadata', onMeta, { once: true });

    // Change source — clear old event handlers for loadedmetadata first
    videoEl.src  = item.url;
    videoEl.load();
  });
}

// ─── Render one image segment ─────────────────────────────────────────────────

function renderImageSegment(canvas, ctx, seg, state, fps, cancelToken) {
  return new Promise(resolve => {
    const { item, duration } = seg;
    const durationMs = duration * 1000;
    const startMs    = performance.now();
    let   animId;

    function draw() {
      if (cancelToken.cancelled) { resolve(); return; }
      if (performance.now() - startMs >= durationMs) { resolve(); return; }

      renderFrame(ctx, canvas.width, canvas.height, null, item, state);
      animId = requestAnimationFrame(draw);
    }

    // Draw first frame immediately
    renderFrame(ctx, canvas.width, canvas.height, null, item, state);
    animId = requestAnimationFrame(draw);
  });
}

// ─── FFmpeg concat export (for repeat + images) ───────────────────────────────

async function exportWithFFmpegConcat(state, sequence, dims, fps, exportSettings, onProgress, onError, cancelToken) {
  let ff;
  try {
    onProgress({ phase: 'FFmpeg 로딩 중...', percent: 0, current: 0, total: 1 });
    ff = await getFFmpeg();
  } catch (e) {
    onError({ code: 'FFMPEG_LOAD', message: e.message });
    return;
  }

  const { w: exportW, h: exportH } = dims;
  const uniqueItems = new Map(); // id → filename
  const totalUnique = [...new Set(sequence.map(s => s.item.id))].length;
  let   processedCount = 0;

  // Pass 1: encode each unique item once
  for (const { item } of sequence) {
    if (cancelToken.cancelled) return;
    if (uniqueItems.has(item.id)) continue;

    processedCount++;
    onProgress({
      phase:   `변환 중: ${item.name}`,
      current: processedCount,
      total:   totalUnique,
      name:    item.name,
      percent: Math.round((processedCount / totalUnique) * 60),
    });

    const outName = `seg_${processedCount}.mp4`;

    try {
      if (item.type === 'video') {
        const fileData = await fetchFile(item.url);
        await ff.writeFile(`raw_${processedCount}`, fileData);
        await ff.exec([
          '-i', `raw_${processedCount}`,
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
          '-c:a', 'aac', '-b:a', '128k',
          '-r', String(fps),
          '-vf', `scale=${exportW}:${exportH}:force_original_aspect_ratio=decrease,pad=${exportW}:${exportH}:(ow-iw)/2:(oh-ih)/2`,
          '-y', outName,
        ]);
        await safeDelete(ff, `raw_${processedCount}`);
      } else if (item.type === 'image') {
        // Render the image frame with overlays to a JPEG, create a video clip
        const offscreen = document.createElement('canvas');
        offscreen.width  = exportW;
        offscreen.height = exportH;
        const offCtx = offscreen.getContext('2d');
        renderFrame(offCtx, exportW, exportH, null, item, state);

        const imgBlob = await new Promise(r => offscreen.toBlob(r, 'image/jpeg', 0.92));
        await ff.writeFile(`img_${processedCount}.jpg`, await fetchFile(imgBlob));

        await ff.exec([
          '-loop', '1',
          '-framerate', String(fps),
          '-i', `img_${processedCount}.jpg`,
          '-t', String(item.imageDuration || 5),
          '-c:v', 'libx264', '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          '-r', String(fps),
          '-an',
          '-y', outName,
        ]);
        await safeDelete(ff, `img_${processedCount}.jpg`);
      }

      uniqueItems.set(item.id, outName);
    } catch (err) {
      onError({
        code:    'SEGMENT_ENCODE',
        message: `인코딩 실패: ${item.name} — ${err.message}`,
        file:    item.name,
      });
      return;
    }
  }

  if (cancelToken.cancelled) return;

  // Build concat list (segments repeat according to sequence)
  onProgress({ phase: '병합 목록 생성 중...', percent: 65 });

  let concatTxt = '';
  for (const seg of sequence) {
    const fname = uniqueItems.get(seg.item.id);
    if (fname) concatTxt += `file '${fname}'\n`;
  }

  await ff.writeFile('concat.txt', new TextEncoder().encode(concatTxt));

  onProgress({ phase: '영상 병합 중...', percent: 70 });

  try {
    await ff.exec([
      '-f', 'concat', '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      '-y', 'output.mp4',
    ]);
  } catch (err) {
    onError({ code: 'CONCAT_FAILED', message: `병합 실패: ${err.message}` });
    return;
  }

  if (cancelToken.cancelled) return;

  onProgress({ phase: '파일 저장 중...', percent: 95 });

  const data = await ff.readFile('output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  // Cleanup FFmpeg virtual FS
  try {
    await safeDelete(ff, 'concat.txt');
    await safeDelete(ff, 'output.mp4');
    for (const fname of uniqueItems.values()) await safeDelete(ff, fname);
  } catch {}

  triggerDownload(blob, 'video/mp4');
  onProgress({ phase: '완료', percent: 100 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSupportedMimeType(format = 'mp4') {
  if (format === 'mp4') {
    for (const t of ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4']) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
  }
  for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

function getBitrate(resolution) {
  switch (resolution) {
    case '720p':    return 5_000_000;
    case 'original': return 15_000_000;
    default:        return 10_000_000; // 1080p
  }
}

function triggerDownload(blob, mimeType) {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `cliphook-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
