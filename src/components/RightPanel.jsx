import React, { useState, useRef, useCallback } from 'react';
import { useEditor } from '../context/EditorContext.jsx';
import { allFonts } from '../config/fontConfig.js';
import { exportMedia, createCancelToken } from '../utils/videoExporter.js';
import { ASPECT_RATIOS } from '../config/constants.js';

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#2a2a38] rounded-xl" style={{ minWidth: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1a1a22] hover:bg-[#1e1e2c] transition-colors"
        style={{ borderRadius: open ? '12px 12px 0 0' : '12px' }}
      >
        <span className="text-xs font-bold text-gray-300">{title}</span>
        <svg className={`w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 bg-[#16161e] flex flex-col gap-2.5 rounded-b-xl" style={{ minWidth: 0 }}>
          {children}
        </div>
      )}
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

function StepControl({ label, value, step, min, max, onChange, display }) {
  const dec = () => onChange(+Math.max(min, value - step).toFixed(4));
  const inc = () => onChange(+Math.min(max, value + step).toFixed(4));
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-1">
        <button onClick={dec}
          className="w-8 h-7 rounded bg-[#2a2a38] text-gray-300 hover:bg-[#3a3a52] flex items-center justify-center text-base font-bold flex-shrink-0 leading-none">
          −
        </button>
        <div className="flex-1 text-center text-xs text-gray-200 bg-[#1a1a22] border border-[#2a2a38] rounded px-1 py-1.5 tabular-nums">
          {display !== undefined ? display : value}
        </div>
        <button onClick={inc}
          className="w-8 h-7 rounded bg-[#2a2a38] text-gray-300 hover:bg-[#3a3a52] flex items-center justify-center text-base font-bold flex-shrink-0 leading-none">
          +
        </button>
      </div>
    </FieldRow>
  );
}

function QuickRow({ label, options, current, onSelect, valueFn = v => v }) {
  return (
    <FieldRow label={label}>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`px-2 py-1 text-xs rounded-lg border transition-colors
              ${valueFn(current) === valueFn(opt.value)
                ? 'bg-blue-600 border-blue-600 text-white font-bold'
                : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500 hover:text-blue-300'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <button onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}>
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function ColorBtn({ label, selected, onClick, className = '' }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
        ${selected ? 'ring-2 ring-blue-500' : ''} ${className}`}>
      {label}
    </button>
  );
}

function PosQuickButtons({ onSetXY }) {
  return (
    <div className="grid grid-cols-3 gap-1 mt-1">
      {[
        { label: '↖ 좌상', x: 15, y: 15 },
        { label: '↑ 위',   x: 50, y: 10 },
        { label: '↗ 우상', x: 85, y: 15 },
        { label: '← 좌',   x: 15, y: 50 },
        { label: '⊙ 중앙', x: 50, y: 50 },
        { label: '→ 우',   x: 85, y: 50 },
        { label: '↙ 좌하', x: 15, y: 85 },
        { label: '↓ 아래', x: 50, y: 90 },
        { label: '↘ 우하', x: 85, y: 85 },
      ].map(p => (
        <button key={`${p.x}-${p.y}`} onClick={() => onSetXY(p.x, p.y)}
          className="py-1 text-[10px] rounded bg-[#1e1e2c] border border-[#2a2a38] text-gray-500 hover:border-blue-500 hover:text-blue-300 transition-colors">
          {p.label}
        </button>
      ))}
    </div>
  );
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function AspectRatioSection({ aspectRatio, setAspectRatio }) {
  return (
    <Section title="화면 비율" defaultOpen>
      <div className="grid grid-cols-3 gap-1">
        {Object.entries(ASPECT_RATIOS).map(([key, val]) => (
          <button key={key} onClick={() => setAspectRatio(key)}
            className={`py-2 px-1 text-xs rounded-lg border transition-colors text-center
              ${aspectRatio === key
                ? 'bg-blue-600 border-blue-600 text-white font-bold'
                : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
            <div className="font-bold">{key}</div>
            <div className="text-[9px] opacity-70 truncate">{val.label.split('·')[1]?.trim()}</div>
          </button>
        ))}
      </div>
    </Section>
  );
}

function VideoSizeSection({ state, setGlobalVideo }) {
  const { globalVideoScale: scale, globalVideoFit: fit, globalVideoX: x, globalVideoY: y } = state;

  const fitOptions = [
    { value: 'fill',     label: '채우기' },
    { value: 'fit',      label: '맞춤' },
    { value: 'original', label: '원본' },
  ];

  return (
    <Section title="영상/이미지 크기·위치" defaultOpen>
      <FieldRow label="맞춤 모드">
        <div className="flex gap-1">
          {fitOptions.map(o => (
            <button key={o.value} onClick={() => setGlobalVideo({ globalVideoFit: o.value })}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors
                ${fit === o.value
                  ? 'bg-blue-600 border-blue-600 text-white font-bold'
                  : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </FieldRow>

      <QuickRow
        label="크기 빠른 선택"
        options={[50, 75, 100, 125, 150].map(v => ({ label: `${v}%`, value: v }))}
        current={scale}
        onSelect={(v) => setGlobalVideo({ globalVideoScale: v })}
      />

      <StepControl label={`크기  ${scale}%`} value={scale} step={5} min={10} max={300}
        onChange={(v) => setGlobalVideo({ globalVideoScale: v })}
        display={`${scale}%`} />

      <StepControl label={`X 위치  ${x > 0 ? '+' : ''}${x}%`} value={x} step={1} min={-50} max={50}
        onChange={(v) => setGlobalVideo({ globalVideoX: v })}
        display={`${x > 0 ? '+' : ''}${x}%`} />

      <StepControl label={`Y 위치  ${y > 0 ? '+' : ''}${y}%`} value={y} step={1} min={-50} max={50}
        onChange={(v) => setGlobalVideo({ globalVideoY: v })}
        display={`${y > 0 ? '+' : ''}${y}%`} />

      <button onClick={() => setGlobalVideo({ globalVideoX: 0, globalVideoY: 0, globalVideoScale: 100 })}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-center w-full py-1">
        위치/크기 초기화
      </button>
    </Section>
  );
}

function TrimSection({ item, updateTrim, updateMedia }) {
  if (!item) {
    return (
      <Section title="영상 자르기 / 이미지 시간">
        <p className="text-xs text-gray-600">미디어를 선택하세요</p>
      </Section>
    );
  }

  if (item.type === 'image') {
    return (
      <Section title="이미지 표시 시간" defaultOpen>
        <StepControl
          label={`표시 시간  ${item.imageDuration || 5}초`}
          value={item.imageDuration || 5}
          step={1} min={1} max={60}
          onChange={(v) => updateMedia(item.id, { imageDuration: v })}
          display={`${item.imageDuration || 5}초`}
        />
        <FieldRow label="마지막 이미지 처리">
          <div className="flex gap-1">
            {[
              { value: 'hold',   label: '끝까지 유지' },
              { value: 'timed',  label: '설정 시간만' },
              { value: 'repeat', label: '반복 전환' },
            ].map(o => (
              <button key={o.value} onClick={() => updateMedia(item.id, { imageEndBehavior: o.value })}
                className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-colors
                  ${(item.imageEndBehavior || 'hold') === o.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </FieldRow>
      </Section>
    );
  }

  const { trim, duration } = item;
  const start = trim?.start || 0;
  const end   = trim?.end   || duration || 0;
  const dur   = Math.max(0, end - start);

  return (
    <Section title="영상 자르기" defaultOpen>
      <div className="text-xs text-gray-500 flex justify-between mb-1">
        <span>시작: <strong className="text-gray-300">{formatTime(start)}</strong></span>
        <span>종료: <strong className="text-gray-300">{formatTime(end)}</strong></span>
        <span>길이: <strong className="text-blue-400">{formatTime(dur)}</strong></span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StepControl label="시작 (초)" value={+start.toFixed(1)} step={0.5} min={0} max={Math.max(0, end - 0.5)}
          onChange={(v) => updateTrim(item.id, { start: v })}
          display={formatTime(start)} />
        <StepControl label="종료 (초)" value={+end.toFixed(1)} step={0.5} min={start + 0.5} max={duration || 9999}
          onChange={(v) => updateTrim(item.id, { end: v })}
          display={formatTime(end)} />
      </div>

      <button
        onClick={() => updateTrim(item.id, { start: 0, end: duration || 0 })}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-center w-full py-1">
        자르기 초기화
      </button>
    </Section>
  );
}

function RepeatSection({ repeatDuration, setRepeatDuration }) {
  const [custom, setCustom] = useState('');

  const presets = [
    { label: '원본 길이', value: 0 },
    { label: '1분',      value: 60 },
    { label: '10분',     value: 600 },
    { label: '30분',     value: 1800 },
    { label: '60분',     value: 3600 },
  ];

  return (
    <Section title="반복 재생 시간">
      <div className="flex flex-wrap gap-1">
        {presets.map(p => (
          <button key={p.value} onClick={() => setRepeatDuration(p.value)}
            className={`px-2 py-1.5 text-xs rounded-lg border transition-colors
              ${repeatDuration === p.value
                ? 'bg-blue-600 border-blue-600 text-white font-bold'
                : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="number" min={1} max={7200} placeholder="직접 입력 (초)"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          className="flex-1 bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
        />
        <button
          onClick={() => { const v = parseInt(custom); if (v > 0) setRepeatDuration(v); }}
          className="px-3 py-1.5 text-xs bg-[#2a2a38] text-gray-300 hover:bg-[#3a3a52] rounded-lg transition-colors">
          적용
        </button>
      </div>

      {repeatDuration > 0 && (
        <p className="text-xs text-blue-400">
          {Math.floor(repeatDuration / 60)}분 {repeatDuration % 60}초 반복 재생
        </p>
      )}
      {repeatDuration > 600 && (
        <p className="text-xs text-amber-400">
          장시간 출력은 FFmpeg를 사용합니다. 시간이 걸릴 수 있습니다.
        </p>
      )}
    </Section>
  );
}

function TitleTextSection({ titleText, updateTitle }) {
  return (
    <Section title="제목 / 후킹 텍스트">
      <ToggleRow label="텍스트 표시" checked={titleText.enabled} onChange={v => updateTitle({ enabled: v })} />

      {titleText.enabled && (
        <>
          <FieldRow label="내용">
            <textarea value={titleText.text} onChange={e => updateTitle({ text: e.target.value })}
              rows={2}
              className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-blue-600" />
          </FieldRow>

          <FieldRow label="폰트">
            <select value={titleText.fontId} onChange={e => updateTitle({ fontId: e.target.value })}
              className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600">
              {allFonts.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </FieldRow>

          <StepControl label={`글자 크기  ${titleText.fontSize}px`} value={titleText.fontSize}
            step={2} min={12} max={160} onChange={v => updateTitle({ fontSize: v })}
            display={`${titleText.fontSize}px`} />

          <FieldRow label="위치 빠른 선택">
            <PosQuickButtons onSetXY={(x, y) => updateTitle({ x, y })} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-2">
            <StepControl label={`X  ${titleText.x}%`} value={titleText.x} step={1} min={0} max={100}
              onChange={v => updateTitle({ x: v })} display={`${titleText.x}%`} />
            <StepControl label={`Y  ${titleText.y}%`} value={titleText.y} step={1} min={0} max={100}
              onChange={v => updateTitle({ y: v })} display={`${titleText.y}%`} />
          </div>

          <FieldRow label="글자 색">
            <div className="flex gap-2">
              <ColorBtn label="흰색" selected={titleText.color === 'white'} onClick={() => updateTitle({ color: 'white' })}
                className="bg-white text-black border-gray-300" />
              <ColorBtn label="검정" selected={titleText.color === 'black'} onClick={() => updateTitle({ color: 'black' })}
                className="bg-black text-white border-gray-700" />
            </div>
          </FieldRow>

          <FieldRow label="배경 색">
            <div className="flex gap-2">
              <ColorBtn label="검정" selected={titleText.bgColor === 'black'} onClick={() => updateTitle({ bgColor: 'black' })}
                className="bg-black text-white border-gray-700" />
              <ColorBtn label="흰색" selected={titleText.bgColor === 'white'} onClick={() => updateTitle({ bgColor: 'white' })}
                className="bg-white text-black border-gray-300" />
              <ColorBtn label="투명" selected={titleText.bgColor === 'transparent'} onClick={() => updateTitle({ bgColor: 'transparent' })}
                className="bg-transparent text-gray-400 border-dashed border-gray-600" />
            </div>
          </FieldRow>

          {titleText.bgColor !== 'transparent' && (
            <StepControl
              label={`배경 투명도  ${Math.round(titleText.bgOpacity * 100)}%`}
              value={Math.round(titleText.bgOpacity * 100)} step={10} min={0} max={100}
              onChange={v => updateTitle({ bgOpacity: v / 100 })}
              display={`${Math.round(titleText.bgOpacity * 100)}%`} />
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
    img.onload = () => updateImageOverlay({ file, url, imgElement: img, enabled: true, visible: true });
    img.src = url;
    e.target.value = '';
  }, [updateImageOverlay]);

  return (
    <Section title="이미지 오버레이" defaultOpen>
      <div className="flex items-center gap-2">
        {imageOverlay.url ? (
          <>
            <img src={imageOverlay.url} className="w-10 h-10 object-contain rounded border border-[#2a2a38] flex-shrink-0" alt="" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">이미지 첨부됨</p>
              <button onClick={() => inputRef.current?.click()} className="text-xs text-blue-400 hover:text-blue-300">변경</button>
            </div>
          </>
        ) : (
          <button onClick={() => inputRef.current?.click()}
            className="w-full py-3 border-2 border-dashed border-[#2a2a38] rounded-xl text-xs text-gray-500 hover:border-blue-600 hover:text-blue-400 transition-colors flex flex-col items-center gap-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            PNG / JPG 이미지 첨부
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {imageOverlay.url && (
        <>
          <ToggleRow label="이미지 표시" checked={imageOverlay.enabled} onChange={v => updateImageOverlay({ enabled: v })} />
          <ToggleRow label="화면에 보임" checked={imageOverlay.visible} onChange={v => updateImageOverlay({ visible: v })} />

          <FieldRow label="위치 빠른 선택">
            <PosQuickButtons onSetXY={(x, y) => updateImageOverlay({ x, y })} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-2">
            <StepControl label={`X  ${imageOverlay.x}%`} value={imageOverlay.x} step={1} min={0} max={100}
              onChange={v => updateImageOverlay({ x: v })} display={`${imageOverlay.x}%`} />
            <StepControl label={`Y  ${imageOverlay.y}%`} value={imageOverlay.y} step={1} min={0} max={100}
              onChange={v => updateImageOverlay({ y: v })} display={`${imageOverlay.y}%`} />
          </div>

          <StepControl label={`크기  ${imageOverlay.widthPct}%`} value={imageOverlay.widthPct} step={5} min={5} max={100}
            onChange={v => updateImageOverlay({ widthPct: v })} display={`${imageOverlay.widthPct}%`} />

          <StepControl label={`투명도  ${Math.round(imageOverlay.opacity * 100)}%`}
            value={Math.round(imageOverlay.opacity * 100)} step={10} min={0} max={100}
            onChange={v => updateImageOverlay({ opacity: v / 100 })}
            display={`${Math.round(imageOverlay.opacity * 100)}%`} />
        </>
      )}
    </Section>
  );
}

function UsernameSection({ username, updateUsername }) {
  const sh = username.shadow || {};

  return (
    <Section title="사용자 이름" defaultOpen>
      <FieldRow label="사용자명">
        <input value={username.text} onChange={e => updateUsername({ text: e.target.value })}
          className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
          placeholder="@username" />
      </FieldRow>

      <ToggleRow label="화면에 표시" checked={username.enabled} onChange={v => updateUsername({ enabled: v })} />

      {username.enabled && (
        <>
          <ToggleRow label="보임" checked={username.visible} onChange={v => updateUsername({ visible: v })} />

          <FieldRow label="위치 빠른 선택">
            <PosQuickButtons onSetXY={(x, y) => updateUsername({ x, y })} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-2">
            <StepControl label={`X  ${username.x}%`} value={username.x} step={1} min={0} max={100}
              onChange={v => updateUsername({ x: v })} display={`${username.x}%`} />
            <StepControl label={`Y  ${username.y}%`} value={username.y} step={1} min={0} max={100}
              onChange={v => updateUsername({ y: v })} display={`${username.y}%`} />
          </div>

          <StepControl label={`글자 크기  ${username.fontSize}px`} value={username.fontSize}
            step={2} min={10} max={120} onChange={v => updateUsername({ fontSize: v })}
            display={`${username.fontSize}px`} />

          <StepControl label={`투명도  ${Math.round(username.opacity * 100)}%`}
            value={Math.round(username.opacity * 100)} step={10} min={0} max={100}
            onChange={v => updateUsername({ opacity: v / 100 })}
            display={`${Math.round(username.opacity * 100)}%`} />

          {/* Shadow settings */}
          <div className="border border-[#2a2a38] rounded-lg p-2 flex flex-col gap-2">
            <ToggleRow label="그림자 효과"
              checked={!!sh.enabled}
              onChange={v => updateUsername({ shadow: { ...sh, enabled: v } })} />

            {sh.enabled && (
              <>
                <FieldRow label="그림자 색상">
                  <input type="color" value={sh.color || '#000000'}
                    onChange={e => updateUsername({ shadow: { ...sh, color: e.target.value } })}
                    className="w-full h-8 rounded border border-[#2a2a38] bg-transparent cursor-pointer" />
                </FieldRow>

                <StepControl label={`강도  ${sh.blur ?? 10}`} value={sh.blur ?? 10}
                  step={2} min={0} max={40}
                  onChange={v => updateUsername({ shadow: { ...sh, blur: v } })}
                  display={sh.blur ?? 10} />

                <div className="grid grid-cols-2 gap-2">
                  <StepControl label={`X 오프셋  ${sh.offsetX ?? 2}`} value={sh.offsetX ?? 2}
                    step={1} min={-20} max={20}
                    onChange={v => updateUsername({ shadow: { ...sh, offsetX: v } })}
                    display={sh.offsetX ?? 2} />
                  <StepControl label={`Y 오프셋  ${sh.offsetY ?? 2}`} value={sh.offsetY ?? 2}
                    step={1} min={-20} max={20}
                    onChange={v => updateUsername({ shadow: { ...sh, offsetY: v } })}
                    display={sh.offsetY ?? 2} />
                </div>
              </>
            )}
          </div>

          <FieldRow label="글자 색">
            <div className="flex gap-2">
              <ColorBtn label="흰색" selected={username.color === 'white'} onClick={() => updateUsername({ color: 'white' })}
                className="bg-white text-black border-gray-300" />
              <ColorBtn label="검정" selected={username.color === 'black'} onClick={() => updateUsername({ color: 'black' })}
                className="bg-black text-white border-gray-700" />
            </div>
          </FieldRow>
        </>
      )}
    </Section>
  );
}

function AIGeneratedSection({ aiGenerated, updateAiGenerated }) {
  const sh = aiGenerated.shadow || {};

  return (
    <Section title="AI 생성물 표시" defaultOpen>
      <FieldRow label="표시 문구">
        <input value={aiGenerated.text} onChange={e => updateAiGenerated({ text: e.target.value })}
          className="w-full bg-[#1e1e2c] border border-[#2a2a38] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
          placeholder="AI 생성물" />
      </FieldRow>

      <ToggleRow label="화면에 표시" checked={aiGenerated.enabled} onChange={v => updateAiGenerated({ enabled: v })} />

      {aiGenerated.enabled && (
        <>
          <ToggleRow label="보임" checked={aiGenerated.visible} onChange={v => updateAiGenerated({ visible: v })} />

          <FieldRow label="위치 빠른 선택">
            <PosQuickButtons onSetXY={(x, y) => updateAiGenerated({ x, y })} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-2">
            <StepControl label={`X  ${aiGenerated.x}%`} value={aiGenerated.x} step={1} min={0} max={100}
              onChange={v => updateAiGenerated({ x: v })} display={`${aiGenerated.x}%`} />
            <StepControl label={`Y  ${aiGenerated.y}%`} value={aiGenerated.y} step={1} min={0} max={100}
              onChange={v => updateAiGenerated({ y: v })} display={`${aiGenerated.y}%`} />
          </div>

          <StepControl label={`글자 크기  ${aiGenerated.fontSize}px`} value={aiGenerated.fontSize}
            step={2} min={10} max={80} onChange={v => updateAiGenerated({ fontSize: v })}
            display={`${aiGenerated.fontSize}px`} />

          <StepControl label={`투명도  ${Math.round(aiGenerated.opacity * 100)}%`}
            value={Math.round(aiGenerated.opacity * 100)} step={10} min={0} max={100}
            onChange={v => updateAiGenerated({ opacity: v / 100 })}
            display={`${Math.round(aiGenerated.opacity * 100)}%`} />

          {/* Shadow settings */}
          <div className="border border-[#2a2a38] rounded-lg p-2 flex flex-col gap-2">
            <ToggleRow label="그림자 효과"
              checked={!!sh.enabled}
              onChange={v => updateAiGenerated({ shadow: { ...sh, enabled: v } })} />

            {sh.enabled && (
              <>
                <FieldRow label="그림자 색상">
                  <input type="color" value={sh.color || '#000000'}
                    onChange={e => updateAiGenerated({ shadow: { ...sh, color: e.target.value } })}
                    className="w-full h-8 rounded border border-[#2a2a38] bg-transparent cursor-pointer" />
                </FieldRow>

                <StepControl label={`강도  ${sh.blur ?? 10}`} value={sh.blur ?? 10}
                  step={2} min={0} max={40}
                  onChange={v => updateAiGenerated({ shadow: { ...sh, blur: v } })}
                  display={sh.blur ?? 10} />

                <div className="grid grid-cols-2 gap-2">
                  <StepControl label={`X 오프셋  ${sh.offsetX ?? 2}`} value={sh.offsetX ?? 2}
                    step={1} min={-20} max={20}
                    onChange={v => updateAiGenerated({ shadow: { ...sh, offsetX: v } })}
                    display={sh.offsetX ?? 2} />
                  <StepControl label={`Y 오프셋  ${sh.offsetY ?? 2}`} value={sh.offsetY ?? 2}
                    step={1} min={-20} max={20}
                    onChange={v => updateAiGenerated({ shadow: { ...sh, offsetY: v } })}
                    display={sh.offsetY ?? 2} />
                </div>
              </>
            )}
          </div>

          <FieldRow label="글자 색">
            <div className="flex gap-2">
              <ColorBtn label="흰색" selected={aiGenerated.color === 'white'} onClick={() => updateAiGenerated({ color: 'white' })}
                className="bg-white text-black border-gray-300" />
              <ColorBtn label="검정" selected={aiGenerated.color === 'black'} onClick={() => updateAiGenerated({ color: 'black' })}
                className="bg-black text-white border-gray-700" />
            </div>
          </FieldRow>
        </>
      )}
    </Section>
  );
}

function ExportSection() {
  const { state, setExportSettings } = useEditor();
  const { exportSettings: es } = state;

  return (
    <Section title="저장 설정">
      <FieldRow label="해상도">
        <div className="flex gap-1">
          {['720p', '1080p', 'original'].map(r => (
            <button key={r} onClick={() => setExportSettings({ resolution: r })}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors
                ${es.resolution === r
                  ? 'bg-blue-600 border-blue-600 text-white font-bold'
                  : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
              {r === 'original' ? '원본' : r}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="프레임레이트">
        <div className="flex gap-1">
          {[24, 30, 60].map(fps => (
            <button key={fps} onClick={() => setExportSettings({ fps })}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors
                ${es.fps === fps
                  ? 'bg-blue-600 border-blue-600 text-white font-bold'
                  : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
              {fps}fps
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="출력 형식">
        <div className="flex gap-1">
          {['mp4', 'webm'].map(fmt => (
            <button key={fmt} onClick={() => setExportSettings({ format: fmt })}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors
                ${es.format === fmt
                  ? 'bg-blue-600 border-blue-600 text-white font-bold'
                  : 'bg-[#1e1e2c] border-[#2a2a38] text-gray-400 hover:border-blue-500'}`}>
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </FieldRow>
    </Section>
  );
}

// ─── Export button ─────────────────────────────────────────────────────────────

function ExportButton() {
  const { state } = useEditor();
  const [status,    setStatus]    = useState(null); // null | 'processing' | 'done' | 'error'
  const [progress,  setProgress]  = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const cancelRef = useRef(null);

  const handleExport = async () => {
    if (!state.mediaItems.length) return;
    setStatus('processing');
    setProgress(null);
    setErrorInfo(null);

    const token = createCancelToken();
    cancelRef.current = token;

    try {
      await exportMedia(
        state,
        (p) => setProgress(p),
        (err) => {
          setStatus('error');
          setErrorInfo(err);
        },
        token,
      );

      if (!token.cancelled) {
        setStatus('done');
        setTimeout(() => setStatus(null), 4000);
      } else {
        setStatus(null);
      }
    } catch (e) {
      setStatus('error');
      setErrorInfo({ code: 'UNKNOWN', message: e.message || String(e) });
    }
  };

  const handleCancel = () => {
    cancelRef.current?.cancel();
    setStatus(null);
    setProgress(null);
  };

  const disabled = !state.mediaItems.length || status === 'processing';
  const count    = state.mediaItems.length;

  return (
    <div className="mt-auto pt-3 flex flex-col gap-2">
      {/* Error display */}
      {status === 'error' && errorInfo && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl px-3 py-2.5">
          <p className="text-xs font-bold text-red-400">내보내기 오류</p>
          <p className="text-xs text-red-300 mt-0.5">{errorInfo.message}</p>
          {errorInfo.file && (
            <p className="text-xs text-red-400/70 mt-0.5">파일: {errorInfo.file}</p>
          )}
        </div>
      )}

      {/* Progress */}
      {status === 'processing' && progress && (
        <div className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-blue-400">{progress.phase || '처리 중'}</span>
            <span className="text-xs text-gray-500 tabular-nums">{progress.percent ?? 0}%</span>
          </div>
          {progress.name && (
            <p className="text-xs text-gray-500 truncate">{progress.name}</p>
          )}
          {progress.current && progress.total && (
            <p className="text-xs text-gray-600">{progress.current} / {progress.total}</p>
          )}
          <div className="mt-2 w-full bg-[#2a2a38] rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent || 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={disabled}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all
            ${disabled
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-900/30'
            }`}
        >
          {status === 'processing' ? '처리 중…'
            : status === 'done'    ? '✓ 다운로드 완료!'
            : status === 'error'   ? '다시 시도'
            : `전체 연결 저장 (${count}개)`}
        </button>

        {status === 'processing' && (
          <button onClick={handleCancel}
            className="px-4 py-3 rounded-xl font-bold text-sm bg-red-900/50 border border-red-800 text-red-400 hover:bg-red-900 transition-colors">
            취소
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function RightPanel() {
  const {
    state, selectedItem,
    setAspectRatio, setGlobalVideo, setRepeatDuration,
    updateTrim, updateMedia,
    updateTitle, updateImageOverlay, updateUsername, updateAiGenerated,
  } = useEditor();

  return (
    <aside className="flex flex-col gap-2 h-full overflow-y-auto overflow-x-hidden" style={{ minWidth: 0 }}>
      <AspectRatioSection aspectRatio={state.aspectRatio} setAspectRatio={setAspectRatio} />
      <VideoSizeSection state={state} setGlobalVideo={setGlobalVideo} />
      <TrimSection item={selectedItem} updateTrim={updateTrim} updateMedia={updateMedia} />
      <RepeatSection repeatDuration={state.repeatDuration} setRepeatDuration={setRepeatDuration} />
      <TitleTextSection titleText={state.titleText} updateTitle={updateTitle} />
      <ImageOverlaySection imageOverlay={state.imageOverlay} updateImageOverlay={updateImageOverlay} />
      <UsernameSection username={state.username} updateUsername={updateUsername} />
      <AIGeneratedSection aiGenerated={state.aiGenerated} updateAiGenerated={updateAiGenerated} />
      <ExportSection />
      <ExportButton />
    </aside>
  );
}
