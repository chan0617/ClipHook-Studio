import React from 'react';

export default function PreviewCanvas({ video, overlays, imageOverlayUrl, selectedFont }) {
  return (
    <main className="preview-shell">
      <div className="preview-header">
        <div>
          <h1>ClipHook Studio</h1>
          <p>Batch clip overlay preview</p>
        </div>
        <span className="status-pill">MVP Preview</span>
      </div>

      <div className="canvas-frame">
        {video ? (
          <video key={video.id} className="preview-video" src={video.url} controls />
        ) : (
          <div className="preview-empty">Upload a video to preview edits</div>
        )}

        {video && overlays.title.enabled && (
          <div
            className={`overlay-title bg-${overlays.title.background}`}
            style={{
              color: overlays.title.color,
              fontFamily: selectedFont.family,
            }}
          >
            {overlays.title.text}
          </div>
        )}

        {video && overlays.image.enabled && imageOverlayUrl && (
          <img
            className="overlay-image"
            src={imageOverlayUrl}
            alt=""
            style={{ width: `${overlays.image.size}%` }}
          />
        )}

        {video && overlays.username.enabled && (
          <div className="overlay-username" style={{ fontFamily: selectedFont.family }}>
            @{overlays.username.text}
          </div>
        )}

        {video && overlays.aiLabel.enabled && (
          <div className="overlay-ai" style={{ opacity: overlays.aiLabel.opacity }}>
            AI 생성물
          </div>
        )}
      </div>
    </main>
  );
}
