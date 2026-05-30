import React from 'react';
import { EditorProvider } from './context/EditorContext.jsx';
import LeftPanel from './components/LeftPanel.jsx';
import CenterPanel from './components/CenterPanel.jsx';
import RightPanel from './components/RightPanel.jsx';

export default function App() {
  return (
    <EditorProvider>
      <div className="flex h-screen overflow-hidden bg-[#111116]">
        {/* Left panel */}
        <div className="w-64 flex-shrink-0 flex flex-col p-3 border-r border-[#1e1e2a] overflow-hidden">
          <LeftPanel />
        </div>

        {/* Center canvas */}
        <div className="flex-1 flex flex-col p-4 min-w-0 overflow-hidden">
          <CenterPanel />
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 flex flex-col p-3 border-l border-[#1e1e2a] overflow-y-auto overflow-x-hidden">
          <RightPanel />
        </div>
      </div>
    </EditorProvider>
  );
}
