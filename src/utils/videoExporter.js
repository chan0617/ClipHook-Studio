import { renderFrame, EXPORT_W, EXPORT_H } from './canvasRenderer.js';

export async function exportAllVideos(state, onProgress, onError) {
  const { videos } = state;
  if (!videos.length) {
    onError('내보낼 영상이 없습니다.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d');

  const mimeType = getSupportedMimeType();
  const stream = canvas.captureStream(30);

  // audio context to capture video audio
  let audioCtx;
  let audioSource;
  let audioDest;
  try {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createMediaStreamDestination();
  } catch {
    // audio not available
  }

  const videoEl = document.createElement('video');
  videoEl.crossOrigin = 'anonymous';
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

  recorder.start(200);

  for (let i = 0; i < videos.length; i++) {
    const videoData = videos[i];
    onProgress({ current: i + 1, total: videos.length, name: videoData.name });
    try {
      await renderSegment(canvas, ctx, videoEl, videoData, state);
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

function renderSegment(canvas, ctx, videoEl, videoData, state) {
  return new Promise((resolve, reject) => {
    const { url, trim } = videoData;
    const endTime = trim.end > trim.start ? trim.end : null;

    videoEl.src = url;
    videoEl.load();

    let animId;
    let started = false;

    function drawLoop() {
      const t = videoEl.currentTime;
      const isEnd = endTime !== null ? t >= endTime : videoEl.ended;

      renderFrame(ctx, canvas.width, canvas.height, videoEl, videoData, state);

      if (isEnd || videoEl.ended || videoEl.paused) {
        cancelAnimationFrame(animId);
        resolve();
        return;
      }
      animId = requestAnimationFrame(drawLoop);
    }

    videoEl.addEventListener(
      'seeked',
      () => {
        if (!started) {
          started = true;
          videoEl.play().catch(() => {});
          animId = requestAnimationFrame(drawLoop);
        }
      },
      { once: true },
    );

    videoEl.addEventListener(
      'loadedmetadata',
      () => {
        const start = Math.max(0, trim.start || 0);
        videoEl.currentTime = start;
      },
      { once: true },
    );

    videoEl.addEventListener('ended', () => {
      cancelAnimationFrame(animId);
      resolve();
    });

    videoEl.addEventListener('error', (e) => {
      cancelAnimationFrame(animId);
      reject(e);
    });

    setTimeout(() => {
      if (!started) {
        cancelAnimationFrame(animId);
        resolve();
      }
    }, 30_000);
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
