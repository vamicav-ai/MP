export type ReelProgressCheckpoint = {
  position_seconds: number;
  watched_seconds: number;
  checkpoint_at: Date;
  completed: number;
};

type ExistingReelProgress = Omit<ReelProgressCheckpoint, "checkpoint_at"> & {
  checkpoint_at: Date | string;
};

export function calculateReelProgress(
  existing: ExistingReelProgress | undefined,
  positionSeconds: number,
  durationSeconds: number,
  now: Date,
): ReelProgressCheckpoint {
  const position = Math.min(Math.floor(positionSeconds), durationSeconds);
  const elapsed = existing
    ? Math.max(0, Math.min(
        45,
        (now.getTime() - (existing.checkpoint_at instanceof Date
          ? existing.checkpoint_at.getTime()
          : Date.parse(existing.checkpoint_at))) / 1000,
      ))
    : 0;
  const forwardDelta = existing ? Math.max(0, position - existing.position_seconds) : 0;
  const watchedDelta = Math.min(forwardDelta, Math.floor(elapsed * 1.5 + 2));
  const watched = Math.min(durationSeconds, (existing?.watched_seconds ?? 0) + watchedDelta);

  return {
    position_seconds: position,
    watched_seconds: watched,
    checkpoint_at: now,
    completed: existing?.completed || watched >= Math.ceil(durationSeconds * 0.9) ? 1 : 0,
  };
}

export function getNextIncompleteReel<T extends { sequence_number: number; completed: number }>(
  reels: T[],
): T | undefined {
  return [...reels].sort((left, right) => left.sequence_number - right.sequence_number)
    .find((reel) => !reel.completed);
}
