import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { EmptyState, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canStudentAccessBatch } from "@/lib/queries";
import { getNextIncompleteReel } from "@/lib/reel-progress";
import type { ReelDocument, ReelProgressDocument, ReelSeriesDocument, SubjectDocument, UserDocument } from "@/lib/models";

type SeriesDetails = { id: number; title: string; topic: string; subject: string; teacher: string; batch_id: number | null };
type ReelRow = { id: number; title: string; description: string; duration_seconds: number; sequence_number: number; completed: number; position_seconds: number };

export default async function ReelSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const user = await requireUser(["student"]);
  const seriesId = Number((await params).seriesId);
  if (!Number.isSafeInteger(seriesId) || seriesId <= 0) notFound();
  const db = getDb();
  const seriesDoc = await db.collection<ReelSeriesDocument>("reel_series").findOne({ id: seriesId, published: 1 });
  const [subject, teacher] = seriesDoc ? await Promise.all([
    db.collection<SubjectDocument>("subjects").findOne({ id: seriesDoc.subject_id }),
    db.collection<UserDocument>("users").findOne({ id: seriesDoc.teacher_id }),
  ]) : [null, null];
  const series: SeriesDetails | undefined = seriesDoc && subject && teacher ? {
    id: seriesDoc.id,
    title: seriesDoc.title,
    topic: seriesDoc.topic,
    batch_id: seriesDoc.batch_id,
    subject: subject.name,
    teacher: teacher.name,
  } : undefined;
  if (!series || !await canStudentAccessBatch(user.id, series.batch_id)) notFound();
  const [reelDocs, progressDocs] = await Promise.all([
    db.collection<ReelDocument>("reels").find({ series_id: seriesId, published: 1 }).sort({ sequence_number: 1 }).toArray(),
    db.collection<ReelProgressDocument>("reel_progress").find({ student_id: user.id }).toArray(),
  ]);
  const progressByReel = new Map(progressDocs.map((progress) => [progress.reel_id, progress]));
  const reels: ReelRow[] = reelDocs.map((reel) => ({
    id: reel.id,
    title: reel.title,
    description: reel.description,
    duration_seconds: reel.duration_seconds,
    sequence_number: reel.sequence_number,
    completed: progressByReel.get(reel.id)?.completed ?? 0,
    position_seconds: progressByReel.get(reel.id)?.position_seconds ?? 0,
  }));
  const next = getNextIncompleteReel(reels);

  return (
    <>
      <PageMessages />
      <Link href="/reels" className="back-link"><ArrowLeft size={16} /> All reel series</Link>
      <div className="series-detail-hero">
        <div className="series-detail-art"><span>{series.subject.toUpperCase()}{series.topic ? ` · ${series.topic.toUpperCase()}` : ""}</span><strong>{String(reels.length).padStart(2, "0")}</strong><span>SHORT LESSONS</span></div>
        <div className="series-detail-copy"><span className="eyebrow">SERIES BY {series.teacher.toUpperCase()}</span><h1>{series.title}</h1><p>Ideas in small steps. Watch a lesson, save your progress, and come back when you’re ready for the next one.</p>{next && <Link className="button button-primary" href={`/reel/${next.id}`}>{next.position_seconds ? "Resume" : "Start"} the next reel <ArrowRight size={16} /></Link>}</div>
      </div>
      <div className="section-heading"><div><span className="eyebrow">THE SERIES</span><h2>{reels.length} short lessons</h2></div></div>
      <div className="reel-list">
        {reels.length ? reels.map((reel) => (
          <Link className={`reel-row ${reel.completed ? "reel-row-complete" : ""}`} href={`/reel/${reel.id}`} key={reel.id}>
            <span className="reel-number">{String(reel.sequence_number).padStart(2, "0")}</span>
            <span className="reel-row-copy"><strong>{reel.title}</strong><span>{reel.description || "A focused idea from this series."}</span></span>
            {reel.completed ? <span className="completed-pill"><Check size={14} /> Complete</span> : <span className="lesson-duration">{reel.duration_seconds}s</span>}
            <ArrowRight size={17} />
          </Link>
        )) : <EmptyState title="No lessons in this series yet">The teacher is preparing the first reel. Check back soon.</EmptyState>}
      </div>
    </>
  );
}
