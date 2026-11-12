import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { EmptyState, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canStudentAccessBatch } from "@/lib/queries";
import { getNextIncompleteReel } from "@/lib/reel-progress";

type SeriesDetails = { id: number; title: string; topic: string; subject: string; teacher: string; batch_id: number | null };
type ReelRow = { id: number; title: string; description: string; duration_seconds: number; sequence_number: number; completed: number; position_seconds: number };

export default async function ReelSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const user = await requireUser(["student"]);
  const seriesId = Number((await params).seriesId);
  if (!Number.isSafeInteger(seriesId) || seriesId <= 0) notFound();
  const db = getDb();
  const series = await db.prepare(`
    SELECT reel_series.id, reel_series.title, reel_series.topic, reel_series.batch_id,
      subjects.name AS subject, users.name AS teacher
    FROM reel_series JOIN subjects ON subjects.id = reel_series.subject_id
    JOIN users ON users.id = reel_series.teacher_id
    WHERE reel_series.id = ? AND reel_series.published = 1
  `).get(seriesId) as SeriesDetails | undefined;
  if (!series || !await canStudentAccessBatch(user.id, series.batch_id)) notFound();
  const reels = await db.prepare(`
    SELECT reels.id, reels.title, reels.description, reels.duration_seconds, reels.sequence_number,
      COALESCE(reel_progress.completed, 0) AS completed, COALESCE(reel_progress.position_seconds, 0) AS position_seconds
    FROM reels LEFT JOIN reel_progress ON reel_progress.reel_id = reels.id AND reel_progress.student_id = ?
    WHERE reels.series_id = ? AND reels.published = 1 ORDER BY reels.sequence_number
  `).all(user.id, seriesId) as ReelRow[];
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
