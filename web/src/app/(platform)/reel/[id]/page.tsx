import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clapperboard } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canStudentAccessBatch } from "@/lib/queries";
import type { ReelDocument, ReelProgressDocument, ReelSeriesDocument, SubjectDocument, UserDocument } from "@/lib/models";

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
  const reelDoc = await db.collection<ReelDocument>("reels").findOne({ id: reelId, published: 1 });
  const seriesDoc = reelDoc
    ? await db.collection<ReelSeriesDocument>("reel_series").findOne({ id: reelDoc.series_id, published: 1 })
    : null;
  const [subject, teacher, progress] = seriesDoc && reelDoc ? await Promise.all([
    db.collection<SubjectDocument>("subjects").findOne({ id: seriesDoc.subject_id }),
    db.collection<UserDocument>("users").findOne({ id: seriesDoc.teacher_id }),
    db.collection<ReelProgressDocument>("reel_progress").findOne({ student_id: user.id, reel_id: reelId }),
  ]) : [null, null, null];
  const reel: ReelDetails | undefined = reelDoc && seriesDoc && subject && teacher ? {
    id: reelDoc.id,
    title: reelDoc.title,
    description: reelDoc.description,
    video_url: reelDoc.video_url,
    duration_seconds: reelDoc.duration_seconds,
    sequence_number: reelDoc.sequence_number,
    series_id: seriesDoc.id,
    series: seriesDoc.title,
    subject: subject.name,
    teacher: teacher.name,
    batch_id: seriesDoc.batch_id,
    position_seconds: progress?.position_seconds ?? 0,
    completed: progress?.completed ?? 0,
  } : undefined;
  if (!reel || !await canStudentAccessBatch(user.id, reel.batch_id)) notFound();

  const next = await db.collection<ReelDocument>("reels")
    .find({ series_id: reel.series_id, published: 1, sequence_number: { $gt: reel.sequence_number } })
    .sort({ sequence_number: 1 })
    .project<{ id: number }>({ id: 1, _id: 0 })
    .next();
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
