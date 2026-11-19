import Link from "next/link";
import { ArrowRight, Clapperboard, Film, Plus } from "lucide-react";
import { togglePublication } from "@/lib/actions";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ClassDocument, ReelDocument, ReelSeriesDocument, SubjectDocument, UserDocument } from "@/lib/models";

type ContentItem = { kind: "Class" | "Series" | "Reel"; id: number; title: string; subject: string; owner: string; published: number; detail: string };

export default async function AdminContentPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const [classDocs, seriesDocs, reelDocs, subjectDocs, userDocs] = await Promise.all([
    db.collection<ClassDocument>("classes").find().toArray(),
    db.collection<ReelSeriesDocument>("reel_series").find().toArray(),
    db.collection<ReelDocument>("reels").find().toArray(),
    db.collection<SubjectDocument>("subjects").find().toArray(),
    db.collection<UserDocument>("users").find().toArray(),
  ]);
  const subjects = new Map(subjectDocs.map((subject) => [subject.id, subject.name]));
  const teachers = new Map(userDocs.map((user) => [user.id, user.name]));
  const reelCounts = new Map<number, number>();
  for (const reel of reelDocs) reelCounts.set(reel.series_id, (reelCounts.get(reel.series_id) ?? 0) + 1);
  const classes = classDocs.flatMap((item) => {
    const subject = subjects.get(item.subject_id);
    const owner = teachers.get(item.teacher_id);
    return subject && owner ? [{
      id: item.id,
      title: item.title,
      subject,
      owner,
      published: item.published,
      detail: "Full-length class",
    }] : [];
  });
  const series = seriesDocs.flatMap((item) => {
    const subject = subjects.get(item.subject_id);
    const owner = teachers.get(item.teacher_id);
    return subject && owner ? [{
      id: item.id,
      title: item.title,
      subject,
      owner,
      published: item.published,
      detail: `${reelCounts.get(item.id) ?? 0} reels in series`,
    }] : [];
  });
  const seriesById = new Map(seriesDocs.map((item) => [item.id, item]));
  const reels = reelDocs.flatMap((item) => {
    const parent = seriesById.get(item.series_id);
    const subject = parent ? subjects.get(parent.subject_id) : undefined;
    const owner = parent ? teachers.get(parent.teacher_id) : undefined;
    return parent && subject && owner ? [{
      id: item.id,
      title: item.title,
      subject,
      owner,
      published: item.published,
      detail: `Episode ${item.sequence_number} · ${parent.title}`,
    }] : [];
  });
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
