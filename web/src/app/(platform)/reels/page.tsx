import Link from "next/link";
import { ArrowRight, Clapperboard, Play } from "lucide-react";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Series = { id: number; title: string; topic: string; subject: string; teacher: string; reel_count: number; completed_count: number };

export default async function ReelsPage() {
  const user = await requireUser(["student"]);
  const series = await getDb().prepare(`
    SELECT reel_series.id, reel_series.title, reel_series.topic, subjects.name AS subject, users.name AS teacher,
      COUNT(reels.id) AS reel_count,
      SUM(CASE WHEN COALESCE(reel_progress.completed, 0) = 1 THEN 1 ELSE 0 END) AS completed_count
    FROM reel_series JOIN subjects ON subjects.id = reel_series.subject_id
    JOIN users ON users.id = reel_series.teacher_id
    JOIN reels ON reels.series_id = reel_series.id AND reels.published = 1
    LEFT JOIN reel_progress ON reel_progress.reel_id = reels.id AND reel_progress.student_id = ?
    WHERE reel_series.published = 1
      AND (reel_series.batch_id IS NULL OR EXISTS (
        SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = reel_series.batch_id AND status = 'active'
      ))
    GROUP BY reel_series.id, reel_series.title, reel_series.topic, subjects.name, users.name, reel_series.created_at
    ORDER BY reel_series.created_at DESC
  `).all(user.id, user.id) as Series[];
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="SHORT LESSONS, BIG IDEAS" title="Educational reels" description="Follow a series, watch in order, and continue right from the next idea." />
      {series.length ? (
        <div className="series-grid">
          {series.map((item, index) => {
            const progress = item.reel_count ? Math.round((item.completed_count / item.reel_count) * 100) : 0;
            return (
              <Link className="series-card" href={`/reels/${item.id}`} key={item.id}>
                <div className={`series-art series-art-${index % 4}`}><span className="series-topic">{item.subject}{item.topic ? ` · ${item.topic}` : ""}</span><Clapperboard size={36} /><span className="series-play"><Play size={15} fill="currentColor" /></span></div>
                <div className="series-copy"><span className="eyebrow">BY {item.teacher.toUpperCase()}</span><strong>{item.title}</strong><div className="series-progress"><span>{item.completed_count} of {item.reel_count} reels</span><span>{progress}%</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="series-link">Continue series <ArrowRight size={15} /></div></div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel"><EmptyState title="Your first reel series is on its way">Once your teacher publishes a reel series for you, it will appear here.</EmptyState></div>
      )}
    </>
  );
}
