import React, { useEffect, useMemo, useState } from 'react';
import EditPanel from './components/EditPanel';
import PreviewCanvas from './components/PreviewCanvas';
import VideoList from './components/VideoList';
import VideoUploader from './components/VideoUploader';
import { fontOptions } from './config/fonts';
import { createExportPlan } from './export/exportPlan';

const MAX_VIDEOS = 10;

const initialOverlays = {
  title: {
    enabled: true,
    text: '영상 제목을 입력하세요',
    color: 'white',
    background: 'black',
  },
  username: {
    enabled: true,
    text: 'username',
  },
  aiLabel: {
    enabled: true,
    opacity: 0.75,
  },
};

export default function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [overlays, setOverlays] = useState(initialOverlays);
  const [selectedFontId, setSelectedFontId] = useState(fontOptions[0].id);

  const selectedVideo = videos.find((video) => video.id === selectedVideoId) || null;
  const selectedFont = fontOptions.find((font) => font.id === selectedFontId) || fontOptions[0];

  const exportPlan = useMemo(
    () => createExportPlan({ videos, overlays: { ...overlays, fontId: selectedFontId } }),
    [videos, overlays, selectedFontId],
  );

  useEffect(() => {
    return () => {
      videos.forEach((video) => URL.revokeObjectURL(video.url));
    };
  }, [videos]);

  function handleAddVideos(files) {
    const slots = MAX_VIDEOS - videos.length;
    const nextVideos = files.slice(0, slots).map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      url: URL.createObjectURL(file),
      startTime: 0,
      endTime: 0,
    }));

    if (nextVideos.length === 0) return;

    setVideos((current) => [...current, ...nextVideos]);
    setSelectedVideoId((current) => current || nextVideos[0].id);
  }

  function handleRemoveVideo(videoId) {
    setVideos((current) => {
      const target = current.find((video) => video.id === videoId);
      if (target) URL.revokeObjectURL(target.url);
      const remaining = current.filter((video) => video.id !== videoId);
      if (selectedVideoId === videoId) {
        setSelectedVideoId(remaining[0]?.id || null);
      }
      return remaining;
    });
  }

  function handleUpdateVideo(videoId, patch) {
    setVideos((current) =>
      current.map((video) => (video.id === videoId ? { ...video, ...patch } : video)),
    );
  }

  function handleUpdateOverlay(key, patch) {
    setOverlays((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  }

  function handleDownloadPlan() {
    const payload = JSON.stringify(exportPlan, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cliphook-export-plan.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="left-panel">
        <VideoUploader count={videos.length} onAddVideos={handleAddVideos} />
        <VideoList
          videos={videos}
          selectedVideoId={selectedVideoId}
          onSelectVideo={setSelectedVideoId}
          onRemoveVideo={handleRemoveVideo}
        />
      </aside>

      <PreviewCanvas
        video={selectedVideo}
        overlays={overlays}
        selectedFont={selectedFont}
      />

      <EditPanel
        selectedVideo={selectedVideo}
        overlays={overlays}
        selectedFontId={selectedFontId}
        onUpdateVideo={handleUpdateVideo}
        onUpdateOverlay={handleUpdateOverlay}
        onSetFont={setSelectedFontId}
        onDownloadPlan={handleDownloadPlan}
        exportPlan={exportPlan}
      />
    </div>
  );
}
