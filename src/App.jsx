import React, { useState } from 'react';
import { EditorProvider } from './context/EditorContext.jsx';
import LeftPanel   from './components/LeftPanel.jsx';
import CenterPanel from './components/CenterPanel.jsx';
import RightPanel  from './components/RightPanel.jsx';

export default function App() {
  const [mobileTab, setMobileTab] = useState('preview'); // 'media' | 'preview' | 'settings'

  return (
    <EditorProvider>
      {/* Desktop / Tablet */}
      <div className="hidden md:flex h-screen overflow-hidden bg-[#111116]">
        {/* Left panel */}
        <div className="flex flex-col p-3 border-r border-[#1e1e2a] overflow-y-auto overflow-x-hidden"
          style={{ width: 'clamp(200px, 22vw, 280px)', flexShrink: 0 }}>
          <LeftPanel />
        </div>

        {/* Center canvas */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden" style={{ minWidth: 0 }}>
          <CenterPanel />
        </div>

        {/* Right panel */}
        <div className="flex flex-col p-3 border-l border-[#1e1e2a] overflow-y-auto overflow-x-hidden"
          style={{ width: 'clamp(260px, 24vw, 340px)', flexShrink: 0 }}>
          <RightPanel />
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden flex-col h-screen bg-[#111116]">
        {/* Panel area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          {mobileTab === 'media'    && <LeftPanel />}
          {mobileTab === 'preview'  && <CenterPanel />}
          {mobileTab === 'settings' && <RightPanel />}
        </div>

        {/* Bottom tab bar */}
        <div className="flex-shrink-0 border-t border-[#1e1e2a] bg-[#13131a] flex">
          {[
            { key: 'media',    label: '미디어',  icon: '🎬' },
            { key: 'preview',  label: '미리보기', icon: '▶' },
            { key: 'settings', label: '설정',    icon: '⚙' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setMobileTab(tab.key)}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors
                ${mobileTab === tab.key ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}>
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </EditorProvider>
  );
}
