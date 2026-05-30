import React from 'react';
import { fontOptions, noonnuFontSlots } from '../config/fonts';

export default function EditPanel({
  selectedVideo,
  overlays,
  selectedFontId,
  onUpdateVideo,
  onUpdateOverlay,
  onSetFont,
  onDownloadPlan,
  exportPlan,
}) {
  return (
    <aside className="right-panel">
      <section className="panel-block">
        <div className="section-heading">
          <h2>영상 자르기</h2>
        </div>
        {selectedVideo ? (
          <div className="field-grid two">
            <label>
              <span>시작 시간</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={selectedVideo.startTime}
                onChange={(event) => onUpdateVideo(selectedVideo.id, { startTime: event.target.value })}
              />
            </label>
            <label>
              <span>종료 시간</span>
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
          <p className="empty-text">먼저 영상을 선택하세요.</p>
        )}
      </section>

      <section className="panel-block">
        <OverlayToggle
          label="제목 표시"
          enabled={overlays.title.enabled}
          onChange={(enabled) => onUpdateOverlay('title', { enabled })}
        />
        <label>
          <span>제목 문구</span>
          <input
            value={overlays.title.text}
            onChange={(event) => onUpdateOverlay('title', { text: event.target.value })}
          />
        </label>
        <div className="field-grid two">
          <label>
            <span>글자색</span>
            <select
              value={overlays.title.color}
              onChange={(event) => onUpdateOverlay('title', { color: event.target.value })}
            >
              <option value="white">흰색</option>
              <option value="black">검정</option>
            </select>
          </label>
          <label>
            <span>제목 배경</span>
            <select
              value={overlays.title.background}
              onChange={(event) => onUpdateOverlay('title', { background: event.target.value })}
            >
              <option value="black">검정</option>
              <option value="white">흰색</option>
              <option value="transparent">투명</option>
            </select>
          </label>
        </div>
        <label>
          <span>폰트</span>
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
          label="@username 표시"
          enabled={overlays.username.enabled}
          onChange={(enabled) => onUpdateOverlay('username', { enabled })}
        />
        <label>
          <span>계정명</span>
          <input
            value={overlays.username.text}
            onChange={(event) => onUpdateOverlay('username', { text: event.target.value })}
          />
        </label>
      </section>

      <section className="panel-block">
        <OverlayToggle
          label="AI 콘텐츠 고지 표시"
          enabled={overlays.aiLabel.enabled}
          onChange={(enabled) => onUpdateOverlay('aiLabel', { enabled })}
        />
        <label>
          <span>투명도</span>
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
          <h2>내보내기용 데이터</h2>
        </div>
        <button type="button" className="download-button" onClick={onDownloadPlan}>
          설정 파일 다운로드
        </button>
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
