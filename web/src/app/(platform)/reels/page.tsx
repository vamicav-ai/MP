import Link from "next/link";
import { ArrowRight, Clapperboard, Play } from "lucide-react";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type {
  EnrollmentDocument,
  ReelDocument,
  ReelProgressDocument,
  ReelSeriesDocument,
  SubjectDocument,
  UserDocument,
} from "@/lib/models";

type Series = { id: number; title: string; topic: string; subject: string; teacher: string; reel_count: number; completed_count: number };

export default async function ReelsPage() {
  const user = await requireUser(["student"]);
  const db = getDb();
  const [seriesDocs, subjectDocs, userDocs, reels, progressDocs, enrollments] = await Promise.all([
    db.collection<ReelSeriesDocument>("reel_series").find({ published: 1 }).sort({ created_at: -1 }).toArray(),
    db.collection<SubjectDocument>("subjects").find().toArray(),
    db.collection<UserDocument>("users").find().toArray(),
    db.collection<ReelDocument>("reels").find({ published: 1 }).toArray(),
    db.collection<ReelProgressDocument>("reel_progress").find({ student_id: user.id }).toArray(),
    db.collection<EnrollmentDocument>("enrollments").find({ student_id: user.id, status: "active" }).toArray(),
  ]);
  const subjects = new Map(subjectDocs.map((subject) => [subject.id, subject.name]));
  const teachers = new Map(userDocs.map((teacher) => [teacher.id, teacher.name]));
  const progressByReel = new Map(progressDocs.map((progress) => [progress.reel_id, progress.completed]));
  const accessibleBatchIds = new Set(enrollments.map((enrollment) => enrollment.batch_id));
  const series: Series[] = seriesDocs.flatMap((item) => {
    if (item.batch_id !== null && !accessibleBatchIds.has(item.batch_id)) return [];
    const subject = subjects.get(item.subject_id);
    const teacher = teachers.get(item.teacher_id);
    const seriesReels = reels.filter((reel) => reel.series_id === item.id);
    if (!subject || !teacher || !seriesReels.length) return [];
    return [{
      id: item.id,
      title: item.title,
      topic: item.topic,
      subject,
      teacher,
      reel_count: seriesReels.length,
      completed_count: seriesReels.filter((reel) => progressByReel.get(reel.id) === 1).length,
    }];
  });
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
