import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clapperboard } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canStudentAccessBatch } from "@/lib/queries";

type ReelDetails = {
  id: number;
  title: string;
  description: string;
  video_url: string;
  duration_seconds: number;
  sequence_number: number;
  series_id: number;
  series: string;
  subject: string;
  teacher: string;
  batch_id: number | null;
  position_seconds: number;
  completed: number;
};

export default async function ReelPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["student"]);
  const reelId = Number((await params).id);
  if (!Number.isSafeInteger(reelId) || reelId <= 0) notFound();
  const db = getDb();
  const reel = await db.prepare(`
    SELECT reels.id, reels.title, reels.description, reels.video_url, reels.duration_seconds,
      reels.sequence_number, reel_series.id AS series_id, reel_series.title AS series,
      reel_series.batch_id, subjects.name AS subject, users.name AS teacher,
      COALESCE(reel_progress.position_seconds, 0) AS position_seconds,
      COALESCE(reel_progress.completed, 0) AS completed
    FROM reels JOIN reel_series ON reel_series.id = reels.series_id
    JOIN subjects ON subjects.id = reel_series.subject_id
    JOIN users ON users.id = reel_series.teacher_id
    LEFT JOIN reel_progress ON reel_progress.reel_id = reels.id AND reel_progress.student_id = ?
    WHERE reels.id = ? AND reels.published = 1 AND reel_series.published = 1
  `).get(user.id, reelId) as ReelDetails | undefined;
  if (!reel || !await canStudentAccessBatch(user.id, reel.batch_id)) notFound();

  const next = await db.prepare(`
    SELECT id FROM reels WHERE series_id = ? AND published = 1 AND sequence_number > ?
    ORDER BY sequence_number LIMIT 1
  `).get(reel.series_id, reel.sequence_number) as { id: number } | undefined;
  const percent = reel.completed ? 100 : Math.min(99, Math.floor((reel.position_seconds / reel.duration_seconds) * 100));

  return (
    <>
      <PageMessages />
      <Link href={`/reels/${reel.series_id}`} className="back-link"><ArrowLeft size={16} /> {reel.series}</Link>
      <div className="player-heading">
        <div><span className="eyebrow">{reel.subject} · EPISODE {String(reel.sequence_number).padStart(2, "0")} · {reel.teacher.toUpperCase()}</span><h1>{reel.title}</h1><p>{reel.description || "One clear idea at a time. Your progress saves as you watch."}</p></div>
        <span className="content-count"><Clapperboard size={16} /> {reel.duration_seconds} sec</span>
      </div>
      <VideoPlayer contentId={reel.id} videoUrl={reel.video_url} initialPosition={reel.position_seconds} type="reel" />
      <div className="reel-watch-footer">
        <div><span className="eyebrow">YOUR PROGRESS</span><strong>{reel.completed ? <><Check size={17} /> Reel completed</> : `${percent}% watched`}</strong><span>90% of a reel must be watched to count as complete.</span></div>
        {next && <Link className="button button-dark" href={`/reel/${next.id}`}>Next reel <ArrowRight size={16} /></Link>}
      </div>
    </>
  );
}
