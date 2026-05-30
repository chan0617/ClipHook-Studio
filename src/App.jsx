import React from 'react';
import { EditorProvider } from './context/EditorContext.jsx';
import LeftPanel from './components/LeftPanel.jsx';
import CenterPanel from './components/CenterPanel.jsx';
import RightPanel from './components/RightPanel.jsx';

export default function App() {
  return (
    <EditorProvider>
      <div className="flex h-screen overflow-hidden bg-[#111116]" style={{ minWidth: 0 }}>
        {/* Left panel */}
        <div style={{ width: 240, flexShrink: 0 }} className="flex flex-col p-3 border-r border-[#1e1e2a] overflow-y-auto overflow-x-hidden">
          <LeftPanel />
        </div>

        {/* Center canvas */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden" style={{ minWidth: 0 }}>
          <CenterPanel />
        </div>

        {/* Right panel */}
        <div style={{ width: 300, flexShrink: 0 }} className="flex flex-col p-3 border-l border-[#1e1e2a] overflow-y-auto overflow-x-hidden">
          <RightPanel />
        </div>
      </div>
    </EditorProvider>
  );
}
