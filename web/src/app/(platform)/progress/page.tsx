import Link from "next/link";
import { ArrowRight, Bell, BookOpen, Clapperboard, GraduationCap } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions";
import { EmptyState, PageHeading, PageMessages, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { money } from "@/lib/queries";
import type {
  BatchDocument,
  ClassDocument,
  ClassProgressDocument,
  EnrollmentDocument,
  NotificationDocument,
  ReelDocument,
  ReelProgressDocument,
  ReelSeriesDocument,
  SubjectDocument,
} from "@/lib/models";

type BatchRow = { title: string; price_paise: number; is_free: number; enrolled_at: string | Date };
type ClassRow = { id: number; title: string; subject: string; position_seconds: number; duration_seconds: number };
type ReelRow = { id: number; title: string; series_id: number; series: string; sequence_number: number; watched_seconds: number; duration_seconds: number; completed: number };
type NotificationRow = { id: number; message: string; created_at: string | Date; read_at: string | Date | null };

export default async function ProgressPage() {
  const user = await requireUser(["student"]);
  const db = getDb();
  const [enrollments, batchDocs, classProgress, classDocs, subjectDocs, reelProgress, reelDocs, seriesDocs, notificationDocs] = await Promise.all([
    db.collection<EnrollmentDocument>("enrollments").find({ student_id: user.id, status: "active" }).sort({ created_at: -1 }).toArray(),
    db.collection<BatchDocument>("batches").find().toArray(),
    db.collection<ClassProgressDocument>("class_progress").find({ student_id: user.id }).sort({ updated_at: -1 }).toArray(),
    db.collection<ClassDocument>("classes").find().toArray(),
    db.collection<SubjectDocument>("subjects").find().toArray(),
    db.collection<ReelProgressDocument>("reel_progress").find({ student_id: user.id }).sort({ updated_at: -1 }).toArray(),
    db.collection<ReelDocument>("reels").find().toArray(),
    db.collection<ReelSeriesDocument>("reel_series").find().toArray(),
    db.collection<NotificationDocument>("notifications").find({ user_id: user.id }).sort({ created_at: -1 }).limit(5).toArray(),
  ]);
  const batchesById = new Map(batchDocs.map((batch) => [batch.id, batch]));
  const batches: BatchRow[] = enrollments.flatMap((enrollment) => {
    const batch = batchesById.get(enrollment.batch_id);
    return batch ? [{
      title: batch.title,
      price_paise: batch.price_paise,
      is_free: batch.is_free,
      enrolled_at: enrollment.created_at,
    }] : [];
  });
  const classById = new Map(classDocs.map((item) => [item.id, item]));
  const subjectById = new Map(subjectDocs.map((item) => [item.id, item.name]));
  const classes: ClassRow[] = classProgress.flatMap((progress) => {
    const item = classById.get(progress.class_id);
    const subject = item ? subjectById.get(item.subject_id) : undefined;
    return item && subject ? [{
      id: item.id,
      title: item.title,
      subject,
      position_seconds: progress.position_seconds,
      duration_seconds: item.duration_seconds,
    }] : [];
  }).slice(0, 6);
  const reelsById = new Map(reelDocs.map((item) => [item.id, item]));
  const seriesById = new Map(seriesDocs.map((item) => [item.id, item]));
  const reels: ReelRow[] = reelProgress.flatMap((progress) => {
    const item = reelsById.get(progress.reel_id);
    const series = item ? seriesById.get(item.series_id) : undefined;
    return item && series ? [{
      id: item.id,
      title: item.title,
      series_id: series.id,
      series: series.title,
      sequence_number: item.sequence_number,
      watched_seconds: progress.watched_seconds,
      duration_seconds: item.duration_seconds,
      completed: progress.completed,
    }] : [];
  }).slice(0, 8);
  const notifications: NotificationRow[] = notificationDocs.map((item) => ({
    id: item.id,
    message: item.message,
    created_at: item.created_at,
    read_at: item.read_at,
  }));
  const completed = reelProgress.filter((progress) => progress.completed === 1).length;
  const active = reelProgress.filter((progress) => progress.completed === 0).length;

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
