import Link from "next/link";
import { ArrowRight, Clapperboard, Plus } from "lucide-react";
import { PageHeading, PageMessages, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function TeacherPage() {
  const user = await requireUser(["teacher"]);
  const db = getDb();
  const classCount = Number((await db.prepare("SELECT COUNT(*) AS count FROM classes WHERE teacher_id = ?").get(user.id) as { count: number }).count);
  const seriesCount = Number((await db.prepare("SELECT COUNT(*) AS count FROM reel_series WHERE teacher_id = ?").get(user.id) as { count: number }).count);
  const published = Number((await db.prepare(`
    SELECT (SELECT COUNT(*) FROM classes WHERE teacher_id = ? AND published = 1) +
           (SELECT COUNT(*) FROM reels JOIN reel_series ON reel_series.id = reels.series_id WHERE reel_series.teacher_id = ? AND reels.published = 1) AS count
  `).get(user.id, user.id) as { count: number }).count);
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="TEACHER SPACE" title={`Your classroom, ${user.name.split(" ")[0]}.`} description="Create lessons and publish small, useful steps for students." action={<Link className="button button-primary" href="/teacher/content"><Plus size={17} /> Create content</Link>} />
      <div className="stats-grid stats-grid-three">
        <StatCard label="Classes" value={classCount} note="Full-length lessons" icon={<Clapperboard size={18} />} />
        <StatCard label="Reel series" value={seriesCount} note="Ordered learning collections" icon={<Clapperboard size={18} />} />
        <StatCard label="Published items" value={published} note="Currently available to students" icon={<ArrowRight size={18} />} />
      </div>
      <section className="teacher-banner"><div className="teacher-banner-mark"><Clapperboard size={28} /></div><div><span className="eyebrow">MAKE A DIFFERENCE</span><h2>A great lesson can change a day.</h2><p>Create a class for a deep dive or a reel for one sharp idea.</p></div><Link href="/teacher/content" className="button button-dark">Open content studio <ArrowRight size={16} /></Link></section>
    </>
  );
}
