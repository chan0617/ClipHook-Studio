import React, { useState, useRef, useCallback } from 'react';
import { useEditor } from '../context/EditorContext.jsx';
import { allFonts } from '../config/fontConfig.js';
import { exportAllVideos } from '../utils/videoExporter.js';

// ─── shared UI ────────────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#2a2a38] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a22] hover:bg-[#1e1e2c] transition-colors"
      >
        <span className="text-xs font-bold text-gray-300">{title}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 bg-[#16161e] flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  );
}

function SliderField({ label, value, min, max, step = 1, onChange, displayValue }) {
  return (
    <FieldRow label={`${label}  ${displayValue ?? value}`}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500"
      />
    </FieldRow>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0
          ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

function ColorButton({ color, label, selected, onClick }) {
  const bg = color === 'black' ? 'bg-black border-gray-600' : color === 'white' ? 'bg-white border-gray-300' : 'bg-transparent border-dashed border-gray-500';
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
        ${selected ? 'ring-2 ring-blue-500' : ''}
        ${color === 'black' ? 'bg-black text-white border-gray-700' :
          color === 'white' ? 'bg-white text-black border-gray-300' :
          'bg-transparent text-gray-400 border-dashed border-gray-600'}`}
    >
      {label}
    </button>
  );
}

// ─── Dual range trim slider ────────────────────────────────────────────────────

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function DualRangeSlider({ min, max, start, end, onStartChange, onEndChange }) {
  const pStart = max > 0 ? ((start - min) / (max - min)) * 100 : 0;
  const pEnd = max > 0 ? ((end - min) / (max - min)) * 100 : 100;

  return (
    <div className="dual-range-wrapper mt-2">
      <div className="range-track-bg" />
      <div
        className="range-track-active"
        style={{ left: `${pStart}%`, width: `${pEnd - pStart}%` }}
      />
      <input
        type="range" min={min} max={max} step={0.1}
        value={start}
        onChange={(e) => {
          const v = Math.min(parseFloat(e.target.value), end - 0.1);
          onStartChange(v);
        }}
      />
      <input
        type="range" min={min} max={max} step={0.1}
        value={end}
        onChange={(e) => {
          const v = Math.max(parseFloat(e.target.value), start + 0.1);
          onEndChange(v);
        }}
      />
    </div>
  );
}

// ─── Panel sections ───────────────────────────────────────────────────────────

function AspectRatioSection() {
  return (
    <Section title="비율 설정" defaultOpen>
      <div className="flex items-center justify-between bg-[#1e1e2c] rounded-lg px-3 py-2.5">
        <span className="text-xs text-gray-400">현재 비율</span>
        <span className="text-xs font-bold text-blue-400">9:16  Shorts / Reels / TikTok</span>
      </div>
    </Section>
  );
}

function TrimSection({ video, updateTrim }) {
  if (!video) {
    return (
      <Section title="영상 자르기">
        <p className="text-xs text-gray-600">영상을 선택하세요</p>
      </Section>
    );
  }

  const { trim, duration } = video;
  const dur = duration || 0;

  return (
    <Section title="영상 자르기" defaultOpen>
      <div className="text-xs text-gray-500 flex justify-between">
        <span>시작: <strong className="text-gray-300">{formatTime(trim.start)}</strong></span>
        <span>종료: <strong className="text-gray-300">{formatTime(trim.end || dur)}</strong></span>
        <span>길이: <strong className="text-blue-400">{formatTime((trim.end || dur) - trim.start)}</strong></span>
      </div>
      <DualRangeSlider
        min={0}
        max={dur}
        start={trim.start}
        end={trim.end || dur}
        onStartChange={(v) => updateTrim(video.id, { start: v })}
        onEndChange={(v) => updateTrim(video.id, { end: v })}
      />
    </Section>
  );
}

function VideoSizeSection({ video, updateVideoSettings }) {
  if (!video) {
    return (
      <Section title="영상 크기/위치">
        <p className="text-xs text-gray-600">영상을 선택하세요</p>
      </Section>
    );
  }

  const { videoSettings: vs } = video;

  const fitOptions = [
    { value: 'fit', label: '화면에 맞춤' },
    { value: 'fill', label: '화면 채우기' },
    { value: 'original', label: '원본 비율 유지' },
  ];

  return (
    <Section title="영상 크기/위치" defaultOpen>
      {/* Fit mode */}
      <FieldRow label="맞춤 모드">
        <div className="flex gap-1.5">
          {fitOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateVideoSettings(video.id, { fit: opt.value })}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors
                ${vs.fit === opt.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-[#3a3a52]'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldRow>

      {/* Scale (only for original mode) */}
      {vs.fit === 'original' && (
        <SliderField
          label="크기"
          value={vs.scale}
          min={10} max={300} step={1}
          onChange={(v) => updateVideoSettings(video.id, { scale: v })}
          displayValue={`${vs.scale}%`}
        />
      )}

      {/* X/Y position */}
      <SliderField
        label="X 위치"
        value={vs.x}
        min={-500} max={500} step={1}
        onChange={(v) => updateVideoSettings(video.id, { x: v })}
        displayValue={`${vs.x}px`}
      />
      <SliderField
        label="Y 위치"
        value={vs.y}
        min={-800} max={800} step={1}
        onChange={(v) => updateVideoSettings(video.id, { y: v })}
        displayValue={`${vs.y}px`}
      />
    </Section>
  );
}

function TitleTextSection({ titleText, updateTitle }) {
  return (
    <Section title="제목 / 후킹 텍스트">
      <ToggleRow
        label="텍스트 표시"
        checked={titleText.enabled}
        onChange={(v) => updateTitle({ enabled: v })}
      />

      {titleText.enabled && (
        <>
          <FieldRow label="텍스트 내용">
            <textarea
              value={titleText.text}
              onChange={(e) => updateTitle({ text: e.target.value })}
              rows={2}
              className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-blue-600"
            />
          </FieldRow>

          <FieldRow label="폰트 선택">
            <select
              value={titleText.fontId}
              onChange={(e) => updateTitle({ fontId: e.target.value })}
              className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
            >
              <optgroup label="기본 폰트">
                {allFonts.filter(f => !f.googleFont && !f.cssUrl).map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </optgroup>
              <optgroup label="웹 폰트">
                {allFonts.filter(f => f.googleFont || f.cssUrl).map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </optgroup>
            </select>
          </FieldRow>

          <SliderField label="글자 크기" value={titleText.fontSize} min={16} max={120} step={1}
            onChange={(v) => updateTitle({ fontSize: v })}
            displayValue={`${titleText.fontSize}px`} />

          <SliderField label="X 위치" value={titleText.x} min={0} max={100} step={1}
            onChange={(v) => updateTitle({ x: v })}
            displayValue={`${titleText.x}%`} />

          <SliderField label="Y 위치" value={titleText.y} min={0} max={100} step={1}
            onChange={(v) => updateTitle({ y: v })}
            displayValue={`${titleText.y}%`} />

          <FieldRow label="글자 색상">
            <div className="flex gap-2">
              <ColorButton color="white" label="흰색" selected={titleText.color === 'white'}
                onClick={() => updateTitle({ color: 'white' })} />
              <ColorButton color="black" label="검정" selected={titleText.color === 'black'}
                onClick={() => updateTitle({ color: 'black' })} />
            </div>
          </FieldRow>

          <FieldRow label="배경 색상">
            <div className="flex gap-2">
              <ColorButton color="black" label="검정" selected={titleText.bgColor === 'black'}
                onClick={() => updateTitle({ bgColor: 'black' })} />
              <ColorButton color="white" label="흰색" selected={titleText.bgColor === 'white'}
                onClick={() => updateTitle({ bgColor: 'white' })} />
              <ColorButton color="transparent" label="투명" selected={titleText.bgColor === 'transparent'}
                onClick={() => updateTitle({ bgColor: 'transparent' })} />
            </div>
          </FieldRow>

          {titleText.bgColor !== 'transparent' && (
            <SliderField label="배경 투명도" value={titleText.bgOpacity} min={0} max={1} step={0.05}
              onChange={(v) => updateTitle({ bgOpacity: v })}
              displayValue={`${Math.round(titleText.bgOpacity * 100)}%`} />
          )}
        </>
      )}
    </Section>
  );
}

function ImageOverlaySection({ imageOverlay, updateImageOverlay }) {
  const inputRef = useRef(null);

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      updateImageOverlay({ file, url, imgElement: img, enabled: true });
    };
    img.src = url;
  }, [updateImageOverlay]);

  return (
    <Section title="이미지 오버레이">
      <ToggleRow label="이미지 표시" checked={imageOverlay.enabled}
        onChange={(v) => updateImageOverlay({ enabled: v })} />

      {imageOverlay.enabled && (
        <>
          {imageOverlay.url ? (
            <div className="flex items-center gap-2">
              <img src={imageOverlay.url} className="w-10 h-10 object-contain rounded border border-[#2a2a38]" alt="" />
              <button
                onClick={() => inputRef.current?.click()}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                이미지 변경
              </button>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full py-2 border border-dashed border-[#2a2a38] rounded-lg text-xs text-gray-500 hover:border-blue-600 hover:text-blue-400 transition-colors"
            >
              PNG / JPG 업로드
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
            className="hidden" onChange={handleFile} />

          <ToggleRow label="이미지 보임" checked={imageOverlay.visible}
            onChange={(v) => updateImageOverlay({ visible: v })} />

          <SliderField label="X 위치" value={imageOverlay.x} min={0} max={100} step={1}
            onChange={(v) => updateImageOverlay({ x: v })} displayValue={`${imageOverlay.x}%`} />
          <SliderField label="Y 위치" value={imageOverlay.y} min={0} max={100} step={1}
            onChange={(v) => updateImageOverlay({ y: v })} displayValue={`${imageOverlay.y}%`} />
          <SliderField label="이미지 크기" value={imageOverlay.widthPct} min={5} max={100} step={1}
            onChange={(v) => updateImageOverlay({ widthPct: v })} displayValue={`${imageOverlay.widthPct}%`} />
          <SliderField label="투명도" value={imageOverlay.opacity} min={0} max={1} step={0.05}
            onChange={(v) => updateImageOverlay({ opacity: v })}
            displayValue={`${Math.round(imageOverlay.opacity * 100)}%`} />
        </>
      )}
    </Section>
  );
}

function UsernameSection({ username, updateUsername }) {
  return (
    <Section title="사용자 이름 (@username)">
      <ToggleRow label="표시" checked={username.enabled}
        onChange={(v) => updateUsername({ enabled: v })} />

      {username.enabled && (
        <>
          <FieldRow label="사용자명">
            <input
              value={username.text}
              onChange={(e) => updateUsername({ text: e.target.value })}
              className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
              placeholder="@username"
            />
          </FieldRow>

          <ToggleRow label="보임" checked={username.visible}
            onChange={(v) => updateUsername({ visible: v })} />

          <SliderField label="X 위치" value={username.x} min={0} max={100} step={1}
            onChange={(v) => updateUsername({ x: v })} displayValue={`${username.x}%`} />
          <SliderField label="Y 위치" value={username.y} min={0} max={100} step={1}
            onChange={(v) => updateUsername({ y: v })} displayValue={`${username.y}%`} />
          <SliderField label="글자 크기" value={username.fontSize} min={12} max={80} step={1}
            onChange={(v) => updateUsername({ fontSize: v })} displayValue={`${username.fontSize}px`} />
          <SliderField label="투명도" value={username.opacity} min={0} max={1} step={0.05}
            onChange={(v) => updateUsername({ opacity: v })}
            displayValue={`${Math.round(username.opacity * 100)}%`} />
        </>
      )}
    </Section>
  );
}

function AIGeneratedSection({ aiGenerated, updateAiGenerated }) {
  return (
    <Section title="AI 생성물 표시">
      <ToggleRow label="표시" checked={aiGenerated.enabled}
        onChange={(v) => updateAiGenerated({ enabled: v })} />

      {aiGenerated.enabled && (
        <>
          <FieldRow label="문구">
            <input
              value={aiGenerated.text}
              onChange={(e) => updateAiGenerated({ text: e.target.value })}
              className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
            />
          </FieldRow>

          <ToggleRow label="보임" checked={aiGenerated.visible}
            onChange={(v) => updateAiGenerated({ visible: v })} />

          <SliderField label="X 위치" value={aiGenerated.x} min={0} max={100} step={1}
            onChange={(v) => updateAiGenerated({ x: v })} displayValue={`${aiGenerated.x}%`} />
          <SliderField label="Y 위치" value={aiGenerated.y} min={0} max={100} step={1}
            onChange={(v) => updateAiGenerated({ y: v })} displayValue={`${aiGenerated.y}%`} />
          <SliderField label="글자 크기" value={aiGenerated.fontSize} min={10} max={60} step={1}
            onChange={(v) => updateAiGenerated({ fontSize: v })} displayValue={`${aiGenerated.fontSize}px`} />
          <SliderField label="투명도" value={aiGenerated.opacity} min={0} max={1} step={0.05}
            onChange={(v) => updateAiGenerated({ opacity: v })}
            displayValue={`${Math.round(aiGenerated.opacity * 100)}%`} />
        </>
      )}
    </Section>
  );
}

// ─── Export button ─────────────────────────────────────────────────────────────

function ExportButton() {
  const { state } = useEditor();
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);

  const handleExport = async () => {
    if (!state.videos.length) return;
    setStatus('processing');
    setProgress(null);
    try {
      await exportAllVideos(
        state,
        (p) => setProgress(p),
        (err) => { setStatus('error'); console.error(err); },
      );
      setStatus('done');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus('error');
      console.error(e);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const disabled = !state.videos.length || status === 'processing';

  return (
    <div className="mt-auto pt-3">
      <button
        onClick={handleExport}
        disabled={disabled}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all
          ${disabled
            ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-900/30'
          }`}
      >
        {status === 'processing'
          ? progress
            ? `처리 중… ${progress.current}/${progress.total}  (${progress.name})`
            : '준비 중…'
          : status === 'done'
          ? '✓ 다운로드 완료!'
          : status === 'error'
          ? '오류 발생 — 다시 시도'
          : `전체 영상 연결 다운로드 (${state.videos.length}개)`}
      </button>
      {status === 'processing' && (
        <p className="text-xs text-gray-600 text-center mt-1">
          실시간 처리 중입니다. 잠시 기다려 주세요.
        </p>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function RightPanel() {
  const {
    state,
    selectedVideo,
    updateVideoSettings,
    updateTrim,
    updateTitle,
    updateImageOverlay,
    updateUsername,
    updateAiGenerated,
  } = useEditor();

  return (
    <aside className="flex flex-col gap-2.5 h-full overflow-y-auto overflow-x-hidden">
      <AspectRatioSection />
      <TrimSection video={selectedVideo} updateTrim={updateTrim} />
      <VideoSizeSection video={selectedVideo} updateVideoSettings={updateVideoSettings} />
      <TitleTextSection titleText={state.titleText} updateTitle={updateTitle} />
      <ImageOverlaySection imageOverlay={state.imageOverlay} updateImageOverlay={updateImageOverlay} />
      <UsernameSection username={state.username} updateUsername={updateUsername} />
      <AIGeneratedSection aiGenerated={state.aiGenerated} updateAiGenerated={updateAiGenerated} />
      <ExportButton />
    </aside>
  );
}
