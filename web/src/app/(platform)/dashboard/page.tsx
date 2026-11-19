import Link from "next/link";
import { ArrowRight, BookOpen, Clapperboard, GraduationCap, UsersRound } from "lucide-react";
import { EmptyState, PageHeading, PageMessages, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { countDocuments } from "@/lib/queries";
import type {
  ClassDocument,
  ClassProgressDocument,
  EnrollmentDocument,
  ReelDocument,
  ReelProgressDocument,
  ReelSeriesDocument,
  SubjectDocument,
} from "@/lib/models";

type ContinueClass = { id: number; title: string; subject: string; position_seconds: number };
type ContinueReel = { id: number; title: string; series_id: number; series: string; position_seconds: number; sequence_number: number };

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();

  if (user.role === "admin") {
    const [students, teachers, batches, pending] = await Promise.all([
      countDocuments("users", { role: "student" }),
      countDocuments("users", { role: "teacher", active: 1 }),
      countDocuments("batches", { published: 1 }),
      countDocuments("offline_payment_requests", { status: "pending" }),
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
    const [classCount, seriesCount, publishedClasses, publishedSeries] = await Promise.all([
      countDocuments("classes", { teacher_id: user.id }),
      countDocuments("reel_series", { teacher_id: user.id }),
      countDocuments("classes", { teacher_id: user.id, published: 1 }),
      countDocuments("reel_series", { teacher_id: user.id, published: 1 }),
    ]);
    const published = publishedClasses + publishedSeries;
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

  const [subjectLinks, classProgress, enrollments, reelProgress] = await Promise.all([
    db.collection<{ student_id: number; subject_id: number }>("student_subjects").find({ student_id: user.id }).toArray(),
    db.collection<ClassProgressDocument>("class_progress").find({ student_id: user.id }).sort({ updated_at: -1 }).toArray(),
    db.collection<EnrollmentDocument>("enrollments").find({ student_id: user.id, status: "active" }).toArray(),
    db.collection<ReelProgressDocument>("reel_progress").find({ student_id: user.id }).toArray(),
  ]);
  const [allSubjects, allClasses, allSeries] = await Promise.all([
    db.collection<SubjectDocument>("subjects").find().toArray(),
    db.collection<ClassDocument>("classes").find({ published: 1 }).toArray(),
    db.collection<ReelSeriesDocument>("reel_series").find({ published: 1 }).sort({ created_at: -1 }).toArray(),
  ]);
  const subjectNames = new Map(allSubjects.map((subject) => [subject.id, subject.name]));
  const subjects = subjectLinks
    .map((link) => ({ id: link.subject_id, name: subjectNames.get(link.subject_id) ?? "" }))
    .filter((subject) => subject.name)
    .sort((left, right) => left.name.localeCompare(right.name));
  const accessibleBatchIds = new Set(enrollments.map((enrollment) => enrollment.batch_id));
  const classesById = new Map(allClasses
    .filter((item) => item.batch_id === null || accessibleBatchIds.has(item.batch_id))
    .map((item) => [item.id, item]));
  const classes: ContinueClass[] = classProgress.flatMap((progress) => {
    const item = classesById.get(progress.class_id);
    const subject = item ? subjectNames.get(item.subject_id) : undefined;
    return item && subject ? [{
      id: item.id,
      title: item.title,
      subject,
      position_seconds: progress.position_seconds,
    }] : [];
  }).slice(0, 3);
  const seriesById = new Map(allSeries
    .filter((series) => series.batch_id === null || accessibleBatchIds.has(series.batch_id))
    .map((series) => [series.id, series]));
  const reelProgressById = new Map(reelProgress.map((progress) => [progress.reel_id, progress]));
  const seriesIds = [...seriesById.keys()];
  const availableReels = seriesIds.length
    ? await db.collection<ReelDocument>("reels")
      .find({ series_id: { $in: seriesIds }, published: 1 })
      .toArray()
    : [];
  const seriesOrder = new Map(seriesIds.map((id, index) => [id, index]));
  availableReels.sort((left, right) =>
    (seriesOrder.get(left.series_id) ?? Number.MAX_SAFE_INTEGER)
      - (seriesOrder.get(right.series_id) ?? Number.MAX_SAFE_INTEGER)
    || left.sequence_number - right.sequence_number);
  const next = availableReels.find((reel) => !reelProgressById.get(reel.id)?.completed);
  const nextSeries = next ? seriesById.get(next.series_id) : undefined;
  const nextReel: ContinueReel | undefined = next && nextSeries
    ? {
        id: next.id,
        title: next.title,
        sequence_number: next.sequence_number,
        series_id: nextSeries.id,
        series: nextSeries.title,
        position_seconds: reelProgressById.get(next.id)?.position_seconds ?? 0,
      }
    : undefined;
  const batchCount = enrollments.length;
  const completedReels = reelProgress.filter((progress) => progress.completed === 1).length;

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
