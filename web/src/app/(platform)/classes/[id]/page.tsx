import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canStudentAccessBatch } from "@/lib/queries";
import type { ClassDocument, ClassProgressDocument, SubjectDocument, UserDocument } from "@/lib/models";

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
  const db = getDb();
  const lessonDoc = await db.collection<ClassDocument>("classes").findOne({ id, published: 1 });
  const [subject, teacher, progress] = lessonDoc ? await Promise.all([
    db.collection<SubjectDocument>("subjects").findOne({ id: lessonDoc.subject_id }),
    db.collection<UserDocument>("users").findOne({ id: lessonDoc.teacher_id }),
    db.collection<ClassProgressDocument>("class_progress").findOne({ student_id: user.id, class_id: id }),
  ]) : [null, null, null];
  const lesson: ClassDetails | undefined = lessonDoc && subject && teacher ? {
    id: lessonDoc.id,
    title: lessonDoc.title,
    description: lessonDoc.description,
    video_url: lessonDoc.video_url,
    duration_seconds: lessonDoc.duration_seconds,
    batch_id: lessonDoc.batch_id,
    subject: subject.name,
    teacher: teacher.name,
    position_seconds: progress?.position_seconds ?? null,
  } : undefined;
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
