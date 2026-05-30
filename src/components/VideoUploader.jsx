import React from 'react';

const MAX_VIDEOS = 10;

export default function VideoUploader({ count, onAddVideos }) {
  const remaining = MAX_VIDEOS - count;

  function handleChange(event) {
    const files = Array.from(event.target.files || []);
    onAddVideos(files.slice(0, remaining));
    event.target.value = '';
  }

  return (
    <section className="panel-block">
      <div className="section-heading">
        <h2>Videos</h2>
        <span>{count}/{MAX_VIDEOS}</span>
      </div>
      <label className={`upload-box ${remaining === 0 ? 'is-disabled' : ''}`}>
        <input
          type="file"
          accept="video/*"
          multiple
          disabled={remaining === 0}
          onChange={handleChange}
        />
        <strong>Upload clips</strong>
        <small>Up to 10 video files</small>
      </label>
    </section>
  );
}
