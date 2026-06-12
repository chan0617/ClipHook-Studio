import { allFonts } from '../config/fontConfig.js';

// Default export dimensions (9:16)
export const EXPORT_W = 1080;
export const EXPORT_H = 1920;

const EXPORT_SIZES = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '1:1':  { w: 1080, h: 1080 },
};

export function getExportSize(aspectRatio) {
  const label = aspectRatio?.label || '9:16';
  return EXPORT_SIZES[label] || EXPORT_SIZES['9:16'];
}

export function renderFrame(ctx, canvasW, canvasH, mediaEl, mediaData, globalState) {
  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Media frame (video or image)
  if (mediaEl) {
    if (mediaData?.type === 'image') {
      // Draw image item
      if (mediaEl.complete || (mediaEl.naturalWidth && mediaEl.naturalWidth > 0)) {
        drawImageMedia(ctx, canvasW, canvasH, mediaEl, globalState);
      }
    } else if (mediaEl.readyState !== undefined && mediaEl.readyState >= 2 && mediaEl.videoWidth > 0) {
      // Draw video frame
      drawVideo(ctx, canvasW, canvasH, mediaEl, mediaData, globalState);
    }
  }

  // Image overlay
  const img = globalState.imageOverlay;
  if (img.enabled && img.visible && img.imgElement) {
    drawImage(ctx, canvasW, canvasH, img);
  }

  // Title text
  const title = globalState.titleText;
  if (title.enabled) {
    drawText(ctx, canvasW, canvasH, title, true);
  }

  // Username
  const usr = globalState.username;
  if (usr.enabled && usr.visible) {
    drawSimpleText(ctx, canvasW, canvasH, usr);
  }

  // AI generated
  const ai = globalState.aiGenerated;
  if (ai.enabled && ai.visible) {
    drawSimpleText(ctx, canvasW, canvasH, ai);
  }
}

function drawImageMedia(ctx, cw, ch, imgEl, globalState) {
  const { x = 0, y = 0, fit = 'fill', scale: vidScale = 100 } = globalState?.videoSettings || {};
  const iw = imgEl.naturalWidth || imgEl.width || cw;
  const ih = imgEl.naturalHeight || imgEl.height || ch;

  const canvasAR = cw / ch;
  const imgAR = iw / ih;

  let drawW, drawH;

  if (fit === 'fill') {
    if (imgAR > canvasAR) {
      drawH = ch;
      drawW = ch * imgAR;
    } else {
      drawW = cw;
      drawH = cw / imgAR;
    }
  } else if (fit === 'fit') {
    if (imgAR > canvasAR) {
      drawW = cw;
      drawH = cw / imgAR;
    } else {
      drawH = ch;
      drawW = ch * imgAR;
    }
  } else {
    drawW = iw;
    drawH = ih;
  }

  const zoom = (vidScale ?? 100) / 100;
  drawW *= zoom;
  drawH *= zoom;

  const drawX = (cw - drawW) / 2 + x;
  const drawY = (ch - drawH) / 2 + y;

  ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);
}

function drawVideo(ctx, cw, ch, videoEl, videoData, globalState) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const { x = 0, y = 0, fit = 'fill', scale: vidScale = 100 } = globalState?.videoSettings || {};

  const canvasAR = cw / ch;
  const videoAR = vw / vh;

  let drawW, drawH;

  if (fit === 'fill') {
    if (videoAR > canvasAR) {
      drawH = ch;
      drawW = ch * videoAR;
    } else {
      drawW = cw;
      drawH = cw / videoAR;
    }
  } else if (fit === 'fit') {
    if (videoAR > canvasAR) {
      drawW = cw;
      drawH = cw / videoAR;
    } else {
      drawH = ch;
      drawW = ch * videoAR;
    }
  } else {
    drawW = vw;
    drawH = vh;
  }

  // scale applies to all fit modes
  const zoom = (vidScale ?? 100) / 100;
  drawW *= zoom;
  drawH *= zoom;

  const drawX = (cw - drawW) / 2 + x;
  const drawY = (ch - drawH) / 2 + y;

  ctx.drawImage(videoEl, drawX, drawY, drawW, drawH);
}

function drawImage(ctx, cw, ch, overlay) {
  const { x, y, widthPct, opacity, imgElement } = overlay;
  const imgW = cw * (widthPct / 100);
  const imgH = imgW * (imgElement.naturalHeight / imgElement.naturalWidth);
  const drawX = (cw * x) / 100 - imgW / 2;
  const drawY = (ch * y) / 100 - imgH / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(imgElement, drawX, drawY, imgW, imgH);
  ctx.restore();
}

function drawText(ctx, cw, ch, settings, bold = false) {
  const { text, x, y, fontSize, color, bgColor, bgOpacity, fontId } = settings;
  const fontData = allFonts.find((f) => f.id === fontId) || allFonts[0];
  const scaledSize = fontSize * (cw / EXPORT_W);
  const weight = bold ? '900' : '400';

  ctx.save();
  ctx.font = `${weight} ${scaledSize}px ${fontData.family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textX = (cw * x) / 100;
  const textY = (ch * y) / 100;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const padX = scaledSize * 0.5;
  const padY = scaledSize * 0.35;
  const boxH = scaledSize * 1.3;

  if (bgColor !== 'transparent') {
    ctx.globalAlpha = bgOpacity;
    ctx.fillStyle = bgColor === 'black' ? '#000000' : '#ffffff';
    roundRect(ctx, textX - textW / 2 - padX, textY - boxH / 2 - padY / 2, textW + padX * 2, boxH + padY, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = color === 'black' ? '#000000' : '#ffffff';
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

function drawSimpleText(ctx, cw, ch, settings) {
  const { text, x, y, fontSize, color = 'white', opacity } = settings;
  const scaledSize = fontSize * (cw / EXPORT_W);

  ctx.save();
  ctx.font = `bold ${scaledSize}px 'Noto Sans KR', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color === 'black' ? '#000000' : '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = scaledSize * 0.4;
  ctx.fillText(text, (cw * x) / 100, (ch * y) / 100);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
