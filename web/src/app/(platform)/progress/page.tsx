import Link from "next/link";
import { ArrowRight, Bell, BookOpen, Clapperboard, GraduationCap } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions";
import { EmptyState, PageHeading, PageMessages, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { money } from "@/lib/queries";

type BatchRow = { title: string; price_paise: number; is_free: number; enrolled_at: string };
type ClassRow = { id: number; title: string; subject: string; position_seconds: number; duration_seconds: number };
type ReelRow = { id: number; title: string; series_id: number; series: string; sequence_number: number; watched_seconds: number; duration_seconds: number; completed: number };
type NotificationRow = { id: number; message: string; created_at: string; read_at: string | null };

export default async function ProgressPage() {
  const user = await requireUser(["student"]);
  const db = getDb();
  const batches = await db.prepare(`
    SELECT batches.title, batches.price_paise, batches.is_free, enrollments.created_at AS enrolled_at
    FROM enrollments JOIN batches ON batches.id = enrollments.batch_id
    WHERE enrollments.student_id = ? AND enrollments.status = 'active' ORDER BY enrollments.created_at DESC
  `).all(user.id) as BatchRow[];
  const classes = await db.prepare(`
    SELECT classes.id, classes.title, subjects.name AS subject, class_progress.position_seconds, classes.duration_seconds
    FROM class_progress JOIN classes ON classes.id = class_progress.class_id
    JOIN subjects ON subjects.id = classes.subject_id
    WHERE class_progress.student_id = ? ORDER BY class_progress.updated_at DESC LIMIT 6
  `).all(user.id) as ClassRow[];
  const reels = await db.prepare(`
    SELECT reels.id, reels.title, reels.sequence_number, reels.duration_seconds,
      reel_series.id AS series_id, reel_series.title AS series,
      reel_progress.watched_seconds, reel_progress.completed
    FROM reel_progress JOIN reels ON reels.id = reel_progress.reel_id
    JOIN reel_series ON reel_series.id = reels.series_id
    WHERE reel_progress.student_id = ? ORDER BY reel_progress.updated_at DESC LIMIT 8
  `).all(user.id) as ReelRow[];
  const notifications = await db.prepare(`
    SELECT id, message, created_at, read_at FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).all(user.id) as NotificationRow[];
  const completed = Number((await db.prepare("SELECT COUNT(*) AS count FROM reel_progress WHERE student_id = ? AND completed = 1").get(user.id) as { count: number }).count);
  const active = Number((await db.prepare("SELECT COUNT(*) AS count FROM reel_progress WHERE student_id = ? AND completed = 0").get(user.id) as { count: number }).count);

  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="YOUR LEARNING JOURNEY" title="Progress that moves with you." description="See what you’ve learned, what’s next, and where you left off." />
      <div className="stats-grid stats-grid-three">
        <StatCard label="Enrolled batches" value={batches.length} note="Your active learning paths" icon={<GraduationCap size={18} />} />
        <StatCard label="Reels completed" value={completed} note="Short lessons finished" icon={<Clapperboard size={18} />} />
        <StatCard label="In progress" value={active + classes.length} note="Pick up whenever you're ready" icon={<BookOpen size={18} />} />
      </div>
      <div className="progress-columns">
        <section>
          <div className="section-heading"><div><span className="eyebrow">KEEP GOING</span><h2>Recent classes</h2></div></div>
          {classes.length ? <div className="mini-list">{classes.map((item) => {
            const progress = item.duration_seconds ? Math.min(100, Math.round(item.position_seconds / item.duration_seconds * 100)) : 0;
            return <Link className="mini-progress-card" href={`/classes/${item.id}`} key={item.id}><div><span className="eyebrow">{item.subject}</span><strong>{item.title}</strong><span>{Math.floor(item.position_seconds / 60)} min watched</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></Link>;
          })}</div> : <div className="panel"><EmptyState title="No class progress yet">Start a class and your progress will appear here.</EmptyState></div>}
        </section>
        <section>
          <div className="section-heading"><div><span className="eyebrow">SMALL WINS</span><h2>Reel progress</h2></div></div>
          {reels.length ? <div className="mini-list">{reels.map((item) => <Link className="reel-progress-card" href={`/reel/${item.id}`} key={item.id}><span className={`mini-reel-number ${item.completed ? "mini-reel-done" : ""}`}>{item.completed ? "✓" : String(item.sequence_number).padStart(2, "0")}</span><span className="mini-reel-copy"><strong>{item.title}</strong><span>{item.series} · {item.completed ? "Completed" : `${item.watched_seconds}/${item.duration_seconds}s watched`}</span></span><ArrowRight size={16} /></Link>)}</div> : <div className="panel"><EmptyState title="Your reel journey starts here">Explore a reel series and your progress will show here.</EmptyState></div>}
        </section>
      </div>
      <section>
        <div className="section-heading"><div><span className="eyebrow">YOUR ENROLLMENTS</span><h2>My batches</h2></div><Link href="/batches" className="text-link">Browse batches <ArrowRight size={15} /></Link></div>
        {batches.length ? <div className="enrollment-table">{batches.map((batch) => <div className="enrollment-row" key={batch.title}><span className="enrollment-icon"><GraduationCap size={18} /></span><strong>{batch.title}</strong><span>{batch.is_free ? "Free" : money(batch.price_paise)}</span><span className="status-pill status-confirmed">Active</span></div>)}</div> : <div className="panel"><EmptyState title="No batches yet">Explore the catalog and join a learning path that suits you.</EmptyState></div>}
      </section>
      <section>
        <div className="section-heading"><div><span className="eyebrow">UPDATES</span><h2>Notifications</h2></div>{notifications.some((item) => !item.read_at) && <form action={markNotificationsRead}><button className="text-link button-as-link" type="submit"><Bell size={15} /> Mark all read</button></form>}</div>
        {notifications.length ? <div className="notification-list">{notifications.map((item) => <div className={`notification-row ${item.read_at ? "" : "notification-unread"}`} key={item.id}><span className="notification-dot" /><span>{item.message}</span><time>{new Date(item.created_at).toLocaleDateString("en-IN")}</time></div>)}</div> : <div className="panel"><EmptyState title="All quiet for now">Important enrollment and payment updates will appear here.</EmptyState></div>}
      </section>
    </>
  );
}
