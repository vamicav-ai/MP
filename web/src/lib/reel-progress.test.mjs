import assert from "node:assert/strict";
import test from "node:test";
import { calculateReelProgress, getNextIncompleteReel } from "./reel-progress.ts";

test("reel progress requires validated watch time to reach the completion threshold", () => {
  const start = new Date("2025-01-01T00:00:00.000Z");
  const firstCheckpoint = calculateReelProgress(undefined, 20, 60, start);
  assert.equal(firstCheckpoint.watched_seconds, 0);
  assert.equal(firstCheckpoint.completed, 0);

  const watching = calculateReelProgress(undefined, 0, 60, start);
  const checkpoint = calculateReelProgress(watching, 40, 60, new Date(start.getTime() + 30_000));
  const beforeThreshold = calculateReelProgress(checkpoint, 53, 60, new Date(start.getTime() + 40_000));
  assert.equal(beforeThreshold.watched_seconds, 53);
  assert.equal(beforeThreshold.completed, 0);

  const atThreshold = calculateReelProgress(beforeThreshold, 54, 60, new Date(start.getTime() + 41_000));
  assert.equal(atThreshold.watched_seconds, 54);
  assert.equal(atThreshold.completed, 1);
});

test("seeking ahead is rate-limited and replaying does not erase earned watch time", () => {
  const start = new Date("2025-01-01T00:00:00.000Z");
  const firstCheckpoint = calculateReelProgress(undefined, 20, 60, start);
  const seekAhead = calculateReelProgress(firstCheckpoint, 60, 60, new Date(start.getTime() + 2_000));
  assert.equal(seekAhead.watched_seconds, 5);
  assert.equal(seekAhead.completed, 0);

  const replay = calculateReelProgress(seekAhead, 10, 60, new Date(start.getTime() + 3_000));
  assert.equal(replay.position_seconds, 10);
  assert.equal(replay.watched_seconds, 5);
});

test("next reel follows the current sequence and skips completed reels", () => {
  const reels = [
    { id: 8, sequence_number: 3, completed: 0 },
    { id: 2, sequence_number: 1, completed: 1 },
    { id: 5, sequence_number: 2, completed: 0 },
  ];

  assert.equal(getNextIncompleteReel(reels)?.id, 5);
  assert.equal(getNextIncompleteReel(reels.slice(1, 2)), undefined);
});
