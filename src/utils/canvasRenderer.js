import { allFonts } from '../config/fontConfig.js';

const EXPORT_REF_W = 1080;

export function renderFrame(ctx, canvasW, canvasH, mediaEl, mediaItem, globalState) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const fit   = globalState.globalVideoFit   || 'fill';
  const scale = (globalState.globalVideoScale ?? 100) / 100;
  const ox    = globalState.globalVideoX ?? 0; // percent
  const oy    = globalState.globalVideoY ?? 0; // percent

  if (mediaItem?.type === 'image') {
    if (mediaItem.imgElement?.complete && mediaItem.imgElement.naturalWidth > 0) {
      drawScaled(ctx, canvasW, canvasH, mediaItem.imgElement, fit, scale, ox, oy);
    }
  } else if (mediaEl && mediaEl.readyState >= 2 && mediaEl.videoWidth > 0) {
    drawScaled(ctx, canvasW, canvasH, mediaEl, fit, scale, ox, oy);
  }

  const img = globalState.imageOverlay;
  if (img.enabled && img.visible && img.imgElement) {
    drawImageOverlay(ctx, canvasW, canvasH, img);
  }

  const title = globalState.titleText;
  if (title.enabled) {
    drawText(ctx, canvasW, canvasH, title);
  }

  const usr = globalState.username;
  if (usr.enabled && usr.visible) {
    drawSimpleText(ctx, canvasW, canvasH, usr);
  }

  const ai = globalState.aiGenerated;
  if (ai.enabled && ai.visible) {
    drawSimpleText(ctx, canvasW, canvasH, ai);
  }
}

function drawScaled(ctx, cw, ch, source, fit, scale, oxPct, oyPct) {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth  : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) return;

  const canvasAR = cw / ch;
  const sourceAR = sw / sh;
  let dw, dh;

  if (fit === 'fill') {
    if (sourceAR > canvasAR) { dh = ch; dw = ch * sourceAR; }
    else                     { dw = cw; dh = cw / sourceAR; }
  } else if (fit === 'fit') {
    if (sourceAR > canvasAR) { dw = cw; dh = cw / sourceAR; }
    else                     { dh = ch; dw = ch * sourceAR; }
  } else {
    dw = sw; dh = sh;
  }

  dw *= scale;
  dh *= scale;

  const dx = (cw - dw) / 2 + (oxPct / 100) * cw;
  const dy = (ch - dh) / 2 + (oyPct / 100) * ch;

  ctx.drawImage(source, dx, dy, dw, dh);
}

function drawImageOverlay(ctx, cw, ch, overlay) {
  const { x, y, widthPct, opacity, imgElement } = overlay;
  const imgW = cw * (widthPct / 100);
  const imgH = imgW * (imgElement.naturalHeight / imgElement.naturalWidth);
  const dx = (cw * x) / 100 - imgW / 2;
  const dy = (ch * y) / 100 - imgH / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(imgElement, dx, dy, imgW, imgH);
  ctx.restore();
}

function drawText(ctx, cw, ch, settings) {
  const { text, x, y, fontSize, color, bgColor, bgOpacity, fontId } = settings;
  const fontData  = allFonts.find(f => f.id === fontId) || allFonts[0];
  const scaledSize = fontSize * (cw / EXPORT_REF_W);

  ctx.save();
  ctx.font = `900 ${scaledSize}px ${fontData.family}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  const textX   = (cw * x) / 100;
  const textY   = (ch * y) / 100;
  const metrics = ctx.measureText(text);
  const textW   = metrics.width;
  const padX    = scaledSize * 0.5;
  const padY    = scaledSize * 0.35;
  const boxH    = scaledSize * 1.3;

  if (bgColor !== 'transparent') {
    ctx.globalAlpha = bgOpacity;
    ctx.fillStyle = bgColor === 'black' ? '#000000' : '#ffffff';
    roundRect(ctx, textX - textW / 2 - padX, textY - boxH / 2 - padY / 2, textW + padX * 2, boxH + padY, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.shadowColor   = 'transparent';
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = color === 'black' ? '#000000' : '#ffffff';
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

function drawSimpleText(ctx, cw, ch, settings) {
  const { text, x, y, fontSize, color = 'white', opacity, shadow } = settings;
  const scaledSize = fontSize * (cw / EXPORT_REF_W);

  ctx.save();
  ctx.font         = `bold ${scaledSize}px 'Noto Sans KR', sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha  = opacity;
  ctx.fillStyle    = color === 'black' ? '#000000' : '#ffffff';

  if (shadow?.enabled) {
    ctx.shadowColor   = shadow.color || '#000000';
    ctx.shadowBlur    = (shadow.blur ?? 10) * (cw / EXPORT_REF_W);
    ctx.shadowOffsetX = shadow.offsetX ?? 2;
    ctx.shadowOffsetY = shadow.offsetY ?? 2;
  } else {
    ctx.shadowColor   = 'transparent';
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

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
