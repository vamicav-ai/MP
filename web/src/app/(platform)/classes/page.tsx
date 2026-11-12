import Link from "next/link";
import { ArrowRight, BookOpen, Play } from "lucide-react";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Lesson = { id: number; title: string; description: string; subject: string; duration_seconds: number; position_seconds: number | null };

export default async function ClassesPage() {
  const user = await requireUser(["student"]);
  const lessons = await getDb().prepare(`
    SELECT classes.id, classes.title, classes.description, subjects.name AS subject,
      classes.duration_seconds, class_progress.position_seconds
    FROM classes JOIN subjects ON subjects.id = classes.subject_id
    LEFT JOIN class_progress ON class_progress.class_id = classes.id AND class_progress.student_id = ?
    WHERE classes.published = 1
      AND (classes.batch_id IS NULL OR EXISTS (
        SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = classes.batch_id AND status = 'active'
      ))
    ORDER BY subjects.name, classes.created_at DESC
  `).all(user.id, user.id) as Lesson[];
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="FULL-LENGTH LEARNING" title="Video classes" description="Settle in, follow along, and pick up where you left off." action={<span className="content-count"><BookOpen size={16} /> {lessons.length} lessons</span>} />
      {lessons.length ? (
        <div className="lesson-list">
          {lessons.map((lesson, index) => (
            <Link href={`/classes/${lesson.id}`} className="lesson-row" key={lesson.id}>
              <span className={`lesson-index lesson-index-${index % 4}`}><Play size={17} fill="currentColor" /></span>
              <span className="lesson-copy"><span className="eyebrow">{lesson.subject}</span><strong>{lesson.title}</strong><small>{lesson.description || "A focused lesson from your learning library."}</small></span>
              <span className="lesson-duration">{lesson.duration_seconds ? `${Math.floor(lesson.duration_seconds / 60)} min` : "Video"}</span>
              <span className="lesson-open"><ArrowRight size={17} /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel"><EmptyState title="Your class library is ready to grow">No classes are published for your account yet. Join a batch or check back after a teacher publishes a lesson.</EmptyState><Link href="/batches" className="button button-primary">Explore batches <ArrowRight size={16} /></Link></div>
      )}
    </>
  );
}
