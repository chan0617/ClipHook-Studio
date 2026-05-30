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
  overlayVideo: {
    enabled: true,
    size: 28,
    x: 72,
    y: 36,
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
  const [overlayVideoUrl, setOverlayVideoUrl] = useState('');

  const selectedVideo = videos.find((video) => video.id === selectedVideoId) || null;
  const selectedFont = fontOptions.find((font) => font.id === selectedFontId) || fontOptions[0];

  const exportPlan = useMemo(
    () => createExportPlan({ videos, overlays: { ...overlays, fontId: selectedFontId } }),
    [videos, overlays, selectedFontId],
  );

  useEffect(() => {
    return () => {
      videos.forEach((video) => URL.revokeObjectURL(video.url));
      if (overlayVideoUrl) URL.revokeObjectURL(overlayVideoUrl);
    };
  }, [videos, overlayVideoUrl]);

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

  function handleOverlayVideoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (overlayVideoUrl) URL.revokeObjectURL(overlayVideoUrl);
    setOverlayVideoUrl(URL.createObjectURL(file));
    event.target.value = '';
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
        overlayVideoUrl={overlayVideoUrl}
        selectedFont={selectedFont}
      />

      <EditPanel
        selectedVideo={selectedVideo}
        overlays={overlays}
        selectedFontId={selectedFontId}
        onUpdateVideo={handleUpdateVideo}
        onUpdateOverlay={handleUpdateOverlay}
        onSetFont={setSelectedFontId}
        onOverlayVideoUpload={handleOverlayVideoUpload}
        exportPlan={exportPlan}
      />
    </div>
  );
}
