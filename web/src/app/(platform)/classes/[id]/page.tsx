import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canStudentAccessBatch } from "@/lib/queries";

type ClassDetails = {
  id: number;
  title: string;
  description: string;
  subject: string;
  teacher: string;
  video_url: string;
  duration_seconds: number;
  batch_id: number | null;
  position_seconds: number | null;
};

export default async function ClassPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["student"]);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const lesson = await getDb().prepare(`
    SELECT classes.id, classes.title, classes.description, classes.video_url, classes.duration_seconds,
      classes.batch_id, subjects.name AS subject, users.name AS teacher, class_progress.position_seconds
    FROM classes JOIN subjects ON subjects.id = classes.subject_id
    JOIN users ON users.id = classes.teacher_id
    LEFT JOIN class_progress ON class_progress.class_id = classes.id AND class_progress.student_id = ?
    WHERE classes.id = ? AND classes.published = 1
  `).get(user.id, id) as ClassDetails | undefined;
  if (!lesson || !await canStudentAccessBatch(user.id, lesson.batch_id)) notFound();

  return (
    <>
      <PageMessages />
      <Link href="/classes" className="back-link"><ArrowLeft size={16} /> Back to classes</Link>
      <div className="player-heading">
        <div><span className="eyebrow">{lesson.subject} · CLASS WITH {lesson.teacher.toUpperCase()}</span><h1>{lesson.title}</h1><p>{lesson.description || "Take your time and learn at your own pace."}</p></div>
        <span className="content-count"><BookOpen size={16} /> {lesson.duration_seconds ? `${Math.floor(lesson.duration_seconds / 60)} min` : "Class"}</span>
      </div>
      <VideoPlayer contentId={lesson.id} videoUrl={lesson.video_url} initialPosition={lesson.position_seconds ?? 0} type="class" />
      <div className="player-note"><strong>Your learning is saved.</strong><span>Return any time to pick up from your last position.</span></div>
    </>
  );
}
