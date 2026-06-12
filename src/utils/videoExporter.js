import { renderFrame, getExportSize } from './canvasRenderer.js';

export async function exportAllVideos(state, onProgress, onError) {
  const { mediaItems } = state;
  if (!mediaItems || !mediaItems.length) {
    onError('내보낼 미디어가 없습니다.');
    return;
  }

  const { w: EXPORT_W, h: EXPORT_H } = getExportSize(state.aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d');

  // Preload all media before starting recording
  await preloadAllMedia(mediaItems);

  const mimeType = getSupportedMimeType();
  const stream = canvas.captureStream(30);

  // Audio context to capture video audio
  let audioCtx;
  let audioSource;
  let audioDest;
  try {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createMediaStreamDestination();
  } catch {
    // audio not available
  }

  // We create a single video element for all video segments
  const videoEl = document.createElement('video');
  videoEl.crossOrigin = 'anonymous';
  videoEl.playsInline = true;
  videoEl.muted = false;

  if (audioCtx) {
    try {
      audioSource = audioCtx.createMediaElementSource(videoEl);
      audioSource.connect(audioDest);
      audioSource.connect(audioCtx.destination);
    } catch {
      // ignore audio errors
    }
  }

  const finalStream =
    audioDest
      ? new MediaStream([...stream.getVideoTracks(), ...audioDest.stream.getAudioTracks()])
      : stream;

  const recorder = new MediaRecorder(finalStream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start(100);

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    onProgress({ current: i + 1, total: mediaItems.length, name: item.name });
    try {
      if (item.type === 'video') {
        await renderVideoSegment(canvas, ctx, videoEl, item, state, EXPORT_W, EXPORT_H);
      } else if (item.type === 'image') {
        await renderImageSegment(canvas, ctx, item, state, EXPORT_W, EXPORT_H);
      }
    } catch (err) {
      console.warn('Segment error:', err);
    }
  }

  recorder.stop();
  videoEl.src = '';

  const blob = await done;

  if (audioCtx) audioCtx.close();

  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cliphook-export.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Preload all media items before starting the recording.
 * For videos: wait for readyState >= 4 (HAVE_ENOUGH_DATA)
 * For images: ensure imgElement is loaded
 */
async function preloadAllMedia(mediaItems) {
  const promises = mediaItems.map((item) => {
    if (item.type === 'video') {
      return new Promise((resolve) => {
        const el = document.createElement('video');
        el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        el.src = item.url;
        if (el.readyState >= 4) {
          item._preloadEl = el;
          resolve();
          return;
        }
        el.addEventListener('canplaythrough', () => {
          item._preloadEl = el;
          resolve();
        }, { once: true });
        el.addEventListener('error', () => resolve(), { once: true });
        el.load();
        // Fallback timeout
        setTimeout(resolve, 15_000);
      });
    } else if (item.type === 'image') {
      return new Promise((resolve) => {
        if (item.imgElement && item.imgElement.complete && item.imgElement.naturalWidth > 0) {
          resolve();
          return;
        }
        const img = item.imgElement || new Image();
        if (img.complete && img.naturalWidth > 0) {
          item.imgElement = img;
          resolve();
          return;
        }
        img.onload = () => { item.imgElement = img; resolve(); };
        img.onerror = () => resolve();
        if (!img.src) img.src = item.url;
        setTimeout(resolve, 10_000);
      });
    }
    return Promise.resolve();
  });
  await Promise.all(promises);
}

/**
 * Render a video segment using seeked → play() pattern with requestVideoFrameCallback
 * or timeupdate for frame-accurate capture.
 */
function renderVideoSegment(canvas, ctx, videoEl, videoData, state, exportW, exportH) {
  return new Promise((resolve) => {
    // Use preloaded element src if available, else use url directly
    videoEl.src = videoData.url;
    videoEl.load();

    let animId;
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        if (animId) cancelAnimationFrame(animId);
        resolve();
      }
    };

    const useRVFC = typeof videoEl.requestVideoFrameCallback === 'function';

    function drawLoop() {
      if (videoEl.ended || videoEl.paused) {
        // Render one last frame then finish
        renderFrame(ctx, exportW, exportH, videoEl, videoData, state);
        safeResolve();
        return;
      }
      renderFrame(ctx, exportW, exportH, videoEl, videoData, state);
      if (useRVFC) {
        videoEl.requestVideoFrameCallback(drawLoop);
      } else {
        animId = requestAnimationFrame(drawLoop);
      }
    }

    videoEl.addEventListener(
      'seeked',
      () => {
        videoEl.play().catch(() => safeResolve());
        if (useRVFC) {
          videoEl.requestVideoFrameCallback(drawLoop);
        } else {
          animId = requestAnimationFrame(drawLoop);
        }
      },
      { once: true },
    );

    videoEl.addEventListener(
      'loadedmetadata',
      () => {
        videoEl.currentTime = 0;
      },
      { once: true },
    );

    videoEl.addEventListener('ended', () => {
      renderFrame(ctx, exportW, exportH, videoEl, videoData, state);
      safeResolve();
    }, { once: true });

    videoEl.addEventListener('error', () => safeResolve(), { once: true });

    // Fallback timeout: max 5 minutes per segment
    setTimeout(safeResolve, 300_000);
  });
}

/**
 * Render an image segment: draw the image to canvas for `duration` seconds.
 */
function renderImageSegment(canvas, ctx, imageData, state, exportW, exportH) {
  return new Promise((resolve) => {
    const { imgElement, duration = 3 } = imageData;
    const durationMs = duration * 1000;
    const startTime = performance.now();

    let animId;
    let resolved = false;

    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        cancelAnimationFrame(animId);
        resolve();
      }
    };

    function drawLoop() {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        renderFrame(ctx, exportW, exportH, imgElement, imageData, state);
        safeResolve();
        return;
      }
      renderFrame(ctx, exportW, exportH, imgElement, imageData, state);
      animId = requestAnimationFrame(drawLoop);
    }

    animId = requestAnimationFrame(drawLoop);

    // Fallback timeout
    setTimeout(safeResolve, durationMs + 5000);
  });
}

function getSupportedMimeType() {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}
