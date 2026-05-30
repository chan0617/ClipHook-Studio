import React from 'react';

export default function VideoList({ videos, selectedVideoId, onSelectVideo, onRemoveVideo }) {
  return (
    <section className="panel-block video-list">
      <div className="section-heading">
        <h2>영상 목록</h2>
      </div>
      {videos.length === 0 ? (
        <p className="empty-text">아직 업로드한 영상이 없습니다.</p>
      ) : (
        videos.map((video, index) => (
          <button
            type="button"
            className={`video-row ${video.id === selectedVideoId ? 'is-active' : ''}`}
            key={video.id}
            onClick={() => onSelectVideo(video.id)}
          >
            <span className="video-index">{index + 1}</span>
            <span className="video-meta">
              <strong>{video.file.name}</strong>
              <small>
                {video.startTime || 0}초 - {video.endTime || 0}초
              </small>
            </span>
            <span
              role="button"
              tabIndex={0}
              className="remove-button"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveVideo(video.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.stopPropagation();
                  onRemoveVideo(video.id);
                }
              }}
            >
              삭제
            </span>
          </button>
        ))
      )}
    </section>
  );
}
