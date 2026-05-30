export function createExportPlan({ videos, overlays }) {
  return {
    version: 1,
    videos: videos.map((video, index) => ({
      id: video.id,
      order: index,
      fileName: video.file.name,
      startTime: Number(video.startTime) || 0,
      endTime: Number(video.endTime) || 0,
    })),
    overlays,
  };
}
