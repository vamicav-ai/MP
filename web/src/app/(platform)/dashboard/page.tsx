import Link from "next/link";
import { ArrowRight, BookOpen, Clapperboard, GraduationCap, UsersRound } from "lucide-react";
import { EmptyState, PageHeading, PageMessages, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { countRows } from "@/lib/queries";

type DashboardSubject = { id: number; name: string };
type ContinueClass = { id: number; title: string; subject: string; position_seconds: number };
type ContinueReel = { id: number; title: string; series_id: number; series: string; position_seconds: number; sequence_number: number };

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();

  if (user.role === "admin") {
    const [students, teachers, batches, pending] = await Promise.all([
      countRows("SELECT COUNT(*) AS count FROM users WHERE role = 'student'"),
      countRows("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher' AND active = 1"),
      countRows("SELECT COUNT(*) AS count FROM batches WHERE published = 1"),
      countRows("SELECT COUNT(*) AS count FROM offline_payment_requests WHERE status = 'pending'"),
    ]);
    return (
      <>
        <PageMessages />
        <PageHeading eyebrow="ADMINISTRATOR" title={`Good to see you, ${user.name.split(" ")[0]}.`} description="Here is the latest activity across your learning platform." />
        <div className="stats-grid">
          <StatCard label="Students" value={students} note="Registered learners" icon={<UsersRound size={18} />} />
          <StatCard label="Teachers" value={teachers} note="Active teaching accounts" icon={<GraduationCap size={18} />} />
          <StatCard label="Live batches" value={batches} note="Published learning groups" icon={<BookOpen size={18} />} />
          <StatCard label="Payment reviews" value={pending} note="Offline requests to review" icon={<Clapperboard size={18} />} />
        </div>
        <div className="section-heading"><div><span className="eyebrow">QUICK ACTIONS</span><h2>Manage your platform</h2></div></div>
        <div className="quick-grid">
          <Link className="quick-card" href="/admin/teachers"><span className="quick-icon violet"><GraduationCap size={20} /></span><strong>Create a teacher</strong><span>Set up an account and assign subjects.</span><ArrowRight size={17} /></Link>
          <Link className="quick-card" href="/admin/content"><span className="quick-icon orange"><Clapperboard size={20} /></span><strong>Manage learning content</strong><span>Review classes, reels, and publication.</span><ArrowRight size={17} /></Link>
          <Link className="quick-card" href="/admin/payments"><span className="quick-icon green"><BookOpen size={20} /></span><strong>Review offline payments</strong><span>Verify collection before unlocking batches.</span><ArrowRight size={17} /></Link>
        </div>
        <section className="panel callout-panel">
          <div className="callout-copy"><span className="eyebrow">YOUR PLATFORM</span><h2>Small lessons. Big progress.</h2><p>Build your library by adding subjects, batches, and learning content.</p></div>
          <Link href="/admin/subjects" className="button button-dark">Add a subject <ArrowRight size={16} /></Link>
        </section>
      </>
    );
  }

  if (user.role === "teacher") {
    const classCount = Number((await db.prepare("SELECT COUNT(*) AS count FROM classes WHERE teacher_id = ?").get(user.id) as { count: number }).count);
    const seriesCount = Number((await db.prepare("SELECT COUNT(*) AS count FROM reel_series WHERE teacher_id = ?").get(user.id) as { count: number }).count);
    const published = Number((await db.prepare(`
      SELECT (SELECT COUNT(*) FROM classes WHERE teacher_id = ? AND published = 1) +
             (SELECT COUNT(*) FROM reel_series WHERE teacher_id = ? AND published = 1) AS count
    `).get(user.id, user.id) as { count: number }).count);
    return (
      <>
        <PageMessages />
        <PageHeading eyebrow="TEACHER SPACE" title={`Welcome, ${user.name.split(" ")[0]}.`} description="Create useful lessons and help students keep moving forward." action={<Link className="button button-primary" href="/teacher/content">Create content <ArrowRight size={16} /></Link>} />
        <div className="stats-grid stats-grid-three">
          <StatCard label="My classes" value={classCount} note="Full-length lessons" icon={<BookOpen size={18} />} />
          <StatCard label="Reel series" value={seriesCount} note="Subject/topic collections" icon={<Clapperboard size={18} />} />
          <StatCard label="Published" value={published} note="Visible to eligible students" icon={<GraduationCap size={18} />} />
        </div>
        <section className="panel content-intro">
          <span className="content-intro-art"><Clapperboard size={30} /></span>
          <div><span className="eyebrow">TEACHING LIBRARY</span><h2>Your next lesson belongs here.</h2><p>Publish a class or build a numbered reel series for one of your assigned subjects.</p></div>
          <Link href="/teacher/content" className="button button-light">Open my content <ArrowRight size={16} /></Link>
        </section>
      </>
    );
  }

  const subjects = await db.prepare(`
    SELECT subjects.id, subjects.name FROM student_subjects
    JOIN subjects ON subjects.id = student_subjects.subject_id
    WHERE student_subjects.student_id = ? ORDER BY subjects.name
  `).all(user.id) as DashboardSubject[];
  const classes = await db.prepare(`
    SELECT classes.id, classes.title, subjects.name AS subject, class_progress.position_seconds
    FROM class_progress JOIN classes ON classes.id = class_progress.class_id
    JOIN subjects ON subjects.id = classes.subject_id
    WHERE class_progress.student_id = ? AND classes.published = 1
      AND (classes.batch_id IS NULL OR EXISTS (
        SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = classes.batch_id AND status = 'active'
      ))
    ORDER BY class_progress.updated_at DESC LIMIT 3
  `).all(user.id, user.id) as ContinueClass[];
  const nextReel = await db.prepare(`
    SELECT reels.id, reels.title, reels.sequence_number, reel_series.id AS series_id,
      reel_series.title AS series, COALESCE(reel_progress.position_seconds, 0) AS position_seconds
    FROM reel_series JOIN reels ON reels.series_id = reel_series.id
    LEFT JOIN reel_progress ON reel_progress.reel_id = reels.id AND reel_progress.student_id = ?
    WHERE reel_series.published = 1 AND reels.published = 1
      AND (reel_series.batch_id IS NULL OR EXISTS (
        SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = reel_series.batch_id AND status = 'active'
      ))
      AND COALESCE(reel_progress.completed, 0) = 0
    ORDER BY reel_series.created_at DESC, reels.sequence_number LIMIT 1
  `).get(user.id, user.id) as ContinueReel | undefined;
  const batchCount = Number((await db.prepare("SELECT COUNT(*) AS count FROM enrollments WHERE student_id = ? AND status = 'active'").get(user.id) as { count: number }).count);
  const completedReels = Number((await db.prepare("SELECT COUNT(*) AS count FROM reel_progress WHERE student_id = ? AND completed = 1").get(user.id) as { count: number }).count);

  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="YOUR LEARNING SPACE" title={`Good morning, ${user.name.split(" ")[0]}.`} description="A little progress every day adds up to something amazing." action={<Link className="button button-primary" href="/batches">Explore batches <ArrowRight size={16} /></Link>} />
      <div className="stats-grid stats-grid-three">
        <StatCard label="My subjects" value={subjects.length} note={subjects.map((s) => s.name).join(" · ") || "Choose what you want to learn"} icon={<GraduationCap size={18} />} />
        <StatCard label="My batches" value={batchCount} note="Your active learning groups" icon={<BookOpen size={18} />} />
        <StatCard label="Reels completed" value={completedReels} note="Every step forward counts" icon={<Clapperboard size={18} />} />
      </div>
      <div className="section-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Continue learning</h2></div></div>
      <div className="continue-grid">
        {nextReel ? (
          <Link className="continue-card continue-card-featured" href={`/reel/${nextReel.id}`}>
            <div className="continue-art reel-art"><span>01</span><Clapperboard size={32} /></div>
            <div className="continue-info"><span className="eyebrow">NEXT REEL · {nextReel.series}</span><strong>{nextReel.title}</strong><span>Episode {nextReel.sequence_number} <ArrowRight size={14} /></span></div>
          </Link>
        ) : (
          <div className="panel"><EmptyState title="Your next reel is waiting">Explore reels when your teacher publishes a series, or choose more subjects.</EmptyState></div>
        )}
        {classes.length ? classes.map((item) => (
          <Link className="continue-card" href={`/classes/${item.id}`} key={item.id}>
            <div className="continue-art class-art"><BookOpen size={28} /></div>
            <div className="continue-info"><span className="eyebrow">{item.subject} · CLASS</span><strong>{item.title}</strong><span>Resume class <ArrowRight size={14} /></span></div>
          </Link>
        )) : (
          <Link className="discovery-card" href="/classes"><span className="quick-icon violet"><BookOpen size={20} /></span><strong>Explore video classes</strong><span>Your saved classes will appear here.</span></Link>
        )}
      </div>
      <section className="subject-banner">
        <div><span className="eyebrow">MAKE IT YOURS</span><strong>Choose the subjects you care about.</strong><span>Your dashboard will bring relevant lessons closer.</span></div>
        <Link href="/subjects" className="button button-dark">My subjects <ArrowRight size={16} /></Link>
      </section>
    </>
  );
}
