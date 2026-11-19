import Link from "next/link";
import { ArrowRight, BookOpen, Play } from "lucide-react";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ClassDocument, ClassProgressDocument, EnrollmentDocument, SubjectDocument } from "@/lib/models";

type Lesson = { id: number; title: string; description: string; subject: string; duration_seconds: number; position_seconds: number | null };

export default async function ClassesPage() {
  const user = await requireUser(["student"]);
  const db = getDb();
  const [classDocs, subjectDocs, progressDocs, enrollments] = await Promise.all([
    db.collection<ClassDocument>("classes").find({ published: 1 }).toArray(),
    db.collection<SubjectDocument>("subjects").find().toArray(),
    db.collection<ClassProgressDocument>("class_progress").find({ student_id: user.id }).toArray(),
    db.collection<EnrollmentDocument>("enrollments").find({ student_id: user.id, status: "active" }).toArray(),
  ]);
  const subjectNames = new Map(subjectDocs.map((subject) => [subject.id, subject.name]));
  const positions = new Map(progressDocs.map((progress) => [progress.class_id, progress.position_seconds]));
  const accessibleBatchIds = new Set(enrollments.map((enrollment) => enrollment.batch_id));
  const lessons: Lesson[] = classDocs.flatMap((item) => {
    const subject = subjectNames.get(item.subject_id);
    if (!subject || (item.batch_id !== null && !accessibleBatchIds.has(item.batch_id))) return [];
    return [{
      id: item.id,
      title: item.title,
      description: item.description,
      subject,
      duration_seconds: item.duration_seconds,
      position_seconds: positions.get(item.id) ?? null,
    }];
  }).sort((left, right) => left.subject.localeCompare(right.subject));
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
