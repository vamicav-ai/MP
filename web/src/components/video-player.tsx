"use client";

import { useRef, useState } from "react";
import { beginReel, saveClassProgress, saveReelProgress } from "@/lib/actions";

export function VideoPlayer({
  contentId,
  videoUrl,
  initialPosition,
  type,
}: {
  contentId: number;
  videoUrl: string;
  initialPosition: number;
  type: "class" | "reel";
}) {
  const lastSaved = useRef(0);
  const [status, setStatus] = useState("Progress saves as you watch.");
  const [failed, setFailed] = useState(false);

  async function save(position: number) {
    try {
      if (type === "reel") await saveReelProgress(contentId, position);
      else await saveClassProgress(contentId, position);
      lastSaved.current = position;
      setFailed(false);
      setStatus("Progress saved");
    } catch {
      setFailed(true);
      setStatus("Could not save your progress. Check your connection and keep this page open.");
    }
  }

  function onLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (initialPosition > 0 && initialPosition < video.duration) video.currentTime = initialPosition;
    const position = video.currentTime;
    lastSaved.current = position;
    if (type === "reel") {
      void beginReel(contentId, position).catch(() => {
        setFailed(true);
        setStatus("Could not save your progress. Check your connection and keep this page open.");
      });
    }
  }

  function onTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const position = event.currentTarget.currentTime;
    if (Math.abs(position - lastSaved.current) >= 10) void save(position);
  }

  return (
    <div className="video-player-wrap">
      <video
        className="video-player"
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPause={(event) => {
          if (Math.abs(event.currentTarget.currentTime - lastSaved.current) >= 2) void save(event.currentTarget.currentTime);
        }}
        onEnded={(event) => void save(event.currentTarget.currentTime)}
      >
        Your browser does not support HTML video playback.
      </video>
      <div className={`save-status ${failed ? "save-status-error" : ""}`} role="status">{status}</div>
    </div>
  );
}
