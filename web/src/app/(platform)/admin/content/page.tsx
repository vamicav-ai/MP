import Link from "next/link";
import { ArrowRight, Clapperboard, Film, Plus } from "lucide-react";
import { togglePublication } from "@/lib/actions";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type ContentItem = { kind: "Class" | "Series" | "Reel"; id: number; title: string; subject: string; owner: string; published: number; detail: string };

export default async function AdminContentPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const classes = await db.prepare(`
    SELECT classes.id, classes.title, subjects.name AS subject, users.name AS owner, classes.published,
      'Full-length class' AS detail FROM classes
    JOIN subjects ON subjects.id = classes.subject_id JOIN users ON users.id = classes.teacher_id
  `).all() as Omit<ContentItem, "kind">[];
  const series = await db.prepare(`
    SELECT reel_series.id, reel_series.title, subjects.name AS subject, users.name AS owner, reel_series.published,
      COUNT(reels.id) || ' reels in series' AS detail FROM reel_series
    JOIN subjects ON subjects.id = reel_series.subject_id JOIN users ON users.id = reel_series.teacher_id
    LEFT JOIN reels ON reels.series_id = reel_series.id
    GROUP BY reel_series.id, reel_series.title, subjects.name, users.name, reel_series.published
  `).all() as Omit<ContentItem, "kind">[];
  const reels = await db.prepare(`
    SELECT reels.id, reels.title, subjects.name AS subject, users.name AS owner, reels.published,
      'Episode ' || reels.sequence_number || ' · ' || reel_series.title AS detail
    FROM reels JOIN reel_series ON reel_series.id = reels.series_id
    JOIN subjects ON subjects.id = reel_series.subject_id JOIN users ON users.id = reel_series.teacher_id
  `).all() as Omit<ContentItem, "kind">[];
  const content: ContentItem[] = [
    ...classes.map((item) => ({ ...item, kind: "Class" as const })),
    ...series.map((item) => ({ ...item, kind: "Series" as const })),
    ...reels.map((item) => ({ ...item, kind: "Reel" as const })),
  ];
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="CONTENT LIBRARY" title="Everything your teachers are building." description="Review publication status for classes and ordered reel series." action={<Link className="button button-primary" href="/teacher/content"><Plus size={16} /> Create content</Link>} />
      <div className="content-summary"><div><span className="content-summary-icon"><Film size={19} /></span><span><strong>{content.length} items</strong><small>{classes.length} classes · {series.length} series · {reels.length} reels</small></span></div><Link href="/admin/teachers" className="text-link">Manage teachers <ArrowRight size={15} /></Link></div>
      {content.length ? <div className="content-admin-list">{content.map((item) => <div className="content-admin-row" key={`${item.kind}-${item.id}`}><span className={`content-type-icon ${item.kind === "Class" ? "violet" : item.kind === "Series" ? "orange" : "green"}`}><Clapperboard size={16} /></span><span className="content-admin-copy"><strong>{item.title}</strong><span>{item.kind} · {item.subject} · {item.owner} · {item.detail}</span></span><span className={`status-pill ${item.published ? "status-confirmed" : "status-draft"}`}>{item.published ? "Published" : "Draft"}</span><form action={togglePublication}><input type="hidden" name="entity" value={item.kind === "Class" ? "class" : item.kind === "Series" ? "series" : "reel"} /><input type="hidden" name="id" value={item.id} /><button className="button button-small button-outline">{item.published ? "Unpublish" : "Publish"}</button></form></div>)}</div> : <div className="panel"><EmptyState title="No learning content yet">Create teacher accounts and invite them to publish classes and reels.</EmptyState></div>}
    </>
  );
}
