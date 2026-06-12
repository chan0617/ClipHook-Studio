export const ASPECT_RATIOS = {
  '9:16': { w: 1080, h: 1920, label: '9:16 · Shorts/Reels/TikTok' },
  '16:9': { w: 1920, h: 1080, label: '16:9 · 유튜브/수평' },
  '1:1':  { w: 1080, h: 1080, label: '1:1 · 정사각형' },
};

export const RESOLUTIONS = {
  '720p':     { scale: 720 },
  '1080p':    { scale: 1080 },
  'original': { scale: 1080 },
};

export function getExportDimensions(aspectRatio, resolution = '1080p') {
  const base = RESOLUTIONS[resolution]?.scale ?? 1080;
  switch (aspectRatio) {
    case '9:16': return { w: base, h: Math.round(base * 16 / 9) };
    case '16:9': return { w: Math.round(base * 16 / 9), h: base };
    case '1:1':  return { w: base, h: base };
    default:     return { w: 1080, h: 1920 };
  }
}

export const MAX_MEDIA_ITEMS = 50;
export const MEMORY_WARNING_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];
export const VIDEO_MIME_TYPES  = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'];
export const IMAGE_EXTENSIONS  = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
export const IMAGE_MIME_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isVideoFile(file) {
  const name = file.name.toLowerCase();
  return (
    VIDEO_MIME_TYPES.includes(file.type) ||
    VIDEO_EXTENSIONS.some(ext => name.endsWith(ext))
  );
}

export function isImageFile(file) {
  const name = file.name.toLowerCase();
  return (
    IMAGE_MIME_TYPES.includes(file.type) ||
    IMAGE_EXTENSIONS.some(ext => name.endsWith(ext))
  );
}

export function needsConversion(file) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    name.endsWith('.mov') || type === 'video/quicktime' ||
    name.endsWith('.m4v') || type === 'video/x-m4v'
  );
}
