import React from 'react';
import { fontOptions, noonnuFontSlots } from '../config/fonts';

export default function EditPanel({
  selectedVideo,
  overlays,
  selectedFontId,
  onUpdateVideo,
  onUpdateOverlay,
  onSetFont,
  onImageUpload,
  exportPlan,
}) {
  return (
    <aside className="right-panel">
      <section className="panel-block">
        <div className="section-heading">
          <h2>Clip trim</h2>
        </div>
        {selectedVideo ? (
          <div className="field-grid two">
            <label>
              <span>Start</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={selectedVideo.startTime}
                onChange={(event) => onUpdateVideo(selectedVideo.id, { startTime: event.target.value })}
              />
            </label>
            <label>
              <span>End</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={selectedVideo.endTime}
                onChange={(event) => onUpdateVideo(selectedVideo.id, { endTime: event.target.value })}
              />
            </label>
          </div>
        ) : (
          <p className="empty-text">Select a clip first.</p>
        )}
      </section>

      <section className="panel-block">
        <OverlayToggle
          label="Title"
          enabled={overlays.title.enabled}
          onChange={(enabled) => onUpdateOverlay('title', { enabled })}
        />
        <label>
          <span>Title text</span>
          <input
            value={overlays.title.text}
            onChange={(event) => onUpdateOverlay('title', { text: event.target.value })}
          />
        </label>
        <div className="field-grid two">
          <label>
            <span>Text color</span>
            <select
              value={overlays.title.color}
              onChange={(event) => onUpdateOverlay('title', { color: event.target.value })}
            >
              <option value="white">white</option>
              <option value="black">black</option>
            </select>
          </label>
          <label>
            <span>Background</span>
            <select
              value={overlays.title.background}
              onChange={(event) => onUpdateOverlay('title', { background: event.target.value })}
            >
              <option value="black">black</option>
              <option value="white">white</option>
              <option value="transparent">transparent</option>
            </select>
          </label>
        </div>
        <label>
          <span>Font</span>
          <select value={selectedFontId} onChange={(event) => onSetFont(event.target.value)}>
            {fontOptions.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
            {noonnuFontSlots.map((font) => (
              <option key={font.id} value={font.id} disabled>
                {font.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel-block">
        <OverlayToggle
          label="Image overlay"
          enabled={overlays.image.enabled}
          onChange={(enabled) => onUpdateOverlay('image', { enabled })}
        />
        <label>
          <span>Image</span>
          <input type="file" accept="image/*" onChange={onImageUpload} />
        </label>
        <label>
          <span>Image size</span>
          <input
            type="range"
            min="10"
            max="70"
            value={overlays.image.size}
            onChange={(event) => onUpdateOverlay('image', { size: event.target.value })}
          />
        </label>
      </section>

      <section className="panel-block">
        <OverlayToggle
          label="@username"
          enabled={overlays.username.enabled}
          onChange={(enabled) => onUpdateOverlay('username', { enabled })}
        />
        <label>
          <span>Username</span>
          <input
            value={overlays.username.text}
            onChange={(event) => onUpdateOverlay('username', { text: event.target.value })}
          />
        </label>
      </section>

      <section className="panel-block">
        <OverlayToggle
          label="AI label"
          enabled={overlays.aiLabel.enabled}
          onChange={(enabled) => onUpdateOverlay('aiLabel', { enabled })}
        />
        <label>
          <span>Opacity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={overlays.aiLabel.opacity}
            onChange={(event) => onUpdateOverlay('aiLabel', { opacity: event.target.value })}
          />
        </label>
      </section>

      <section className="panel-block export-block">
        <div className="section-heading">
          <h2>Export-ready data</h2>
        </div>
        <pre>{JSON.stringify(exportPlan, null, 2)}</pre>
      </section>
    </aside>
  );
}

function OverlayToggle({ label, enabled, onChange }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
