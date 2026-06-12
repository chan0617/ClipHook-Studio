import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let instance = null;
let loading   = false;

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export async function getFFmpeg(onLog) {
  if (instance) return instance;

  if (loading) {
    while (loading) await new Promise(r => setTimeout(r, 100));
    if (instance) return instance;
    throw new Error('FFmpeg 로딩에 실패했습니다.');
  }

  loading = true;
  try {
    const ff = new FFmpeg();
    if (onLog) ff.on('log', ({ message }) => onLog(message));

    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`,   'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    instance = ff;
    return ff;
  } catch (e) {
    throw new Error(`FFmpeg 로딩 실패: ${e.message}`);
  } finally {
    loading = false;
  }
}

export function isFFmpegLoaded() {
  return !!instance;
}

export async function transcodeToMp4(file, onProgress) {
  const ff = await getFFmpeg();

  const ext  = file.name.split('.').pop() || 'mov';
  const inp  = `in_${Date.now()}.${ext}`;
  const out  = `out_${Date.now()}.mp4`;

  ff.on('progress', ({ progress }) => onProgress?.(Math.round(progress * 100)));

  try {
    await ff.writeFile(inp, await fetchFile(file));

    await ff.exec([
      '-i', inp,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-c:a', 'aac', '-b:a', '128k',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-movflags', '+faststart',
      '-y', out,
    ]);

    const data = await ff.readFile(out);
    return new Blob([data.buffer], { type: 'video/mp4' });
  } finally {
    await safeDelete(ff, inp);
    await safeDelete(ff, out);
  }
}

export async function canBrowserPlay(url) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.muted   = true;
    v.preload = 'metadata';
    const t   = setTimeout(() => { v.src = ''; resolve(false); }, 5000);

    v.addEventListener('loadedmetadata', () => {
      clearTimeout(t);
      v.src = '';
      resolve(true);
    }, { once: true });

    v.addEventListener('error', () => {
      clearTimeout(t);
      resolve(false);
    }, { once: true });

    v.src = url;
    v.load();
  });
}

export async function safeDelete(ff, name) {
  try { await ff.deleteFile(name); } catch {}
}
