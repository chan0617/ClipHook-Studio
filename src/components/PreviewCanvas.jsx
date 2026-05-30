import React from 'react';

export default function PreviewCanvas({ video, overlays, selectedFont }) {
  return (
    <main className="preview-shell">
      <div className="preview-header">
        <div>
          <h1>ClipHook Studio</h1>
          <p>세로형 숏츠 미리보기</p>
        </div>
        <span className="status-pill">9:16 세로 캔버스</span>
      </div>

      <div className="canvas-frame">
        {video ? (
          <video key={video.id} className="preview-video" src={video.url} controls />
        ) : (
          <div className="preview-empty">영상을 업로드하면 여기에서 미리 볼 수 있습니다</div>
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

        {video && overlays.username.enabled && (
          <div className="overlay-username" style={{ fontFamily: selectedFont.family }}>
            @{overlays.username.text}
          </div>
        )}

        {video && overlays.aiLabel.enabled && (
          <div className="overlay-ai" style={{ opacity: overlays.aiLabel.opacity }}>
            <span>이 영상은 AI 콘텐츠입니다.</span>
            <span>AI-generated content.</span>
          </div>
        )}
      </div>
    </main>
  );
}
