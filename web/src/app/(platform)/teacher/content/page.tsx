import { createClass, createReel, createReelSeries, togglePublication } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { BatchDocument, ClassDocument, ReelDocument, ReelSeriesDocument, SubjectDocument } from "@/lib/models";

type OwnedClass = { id: number; title: string; subject: string; published: number };
type OwnedSeries = { id: number; title: string; subject: string; published: number; reel_count: number };
type OwnedReel = { id: number; title: string; series: string; published: number; sequence_number: number };
type TeacherSubject = { id: number; name: string };

export default async function TeacherContentPage() {
  const user = await requireUser(["teacher", "admin"]);
  const db = getDb();
  const [subjectDocs, assignments, classDocs, seriesDocs, reelDocs, batchDocs] = await Promise.all([
    db.collection<SubjectDocument>("subjects").find({ active: 1 }).sort({ name: 1 }).toArray(),
    user.role === "admin"
      ? Promise.resolve([])
      : db.collection<{ teacher_id: number; subject_id: number }>("teacher_subjects").find({ teacher_id: user.id }).toArray(),
    db.collection<ClassDocument>("classes")
      .find(user.role === "admin" ? {} : { teacher_id: user.id }).sort({ created_at: -1 }).toArray(),
    db.collection<ReelSeriesDocument>("reel_series")
      .find(user.role === "admin" ? {} : { teacher_id: user.id }).sort({ created_at: -1 }).toArray(),
    db.collection<ReelDocument>("reels").find().toArray(),
    db.collection<BatchDocument>("batches").find({ published: 1 }).sort({ title: 1 }).toArray(),
  ]);
  const subjects: TeacherSubject[] = (user.role === "admin"
    ? subjectDocs
    : subjectDocs.filter((subject) => assignments.some((assignment) => assignment.subject_id === subject.id)))
    .map(({ id, name }) => ({ id, name }));
  const subjectNames = new Map(subjectDocs.map((subject) => [subject.id, subject.name]));
  const seriesNames = new Map(seriesDocs.map((item) => [item.id, item.title]));
  const reelsBySeries = new Map<number, number>();
  for (const reel of reelDocs) reelsBySeries.set(reel.series_id, (reelsBySeries.get(reel.series_id) ?? 0) + 1);
  const classes: OwnedClass[] = classDocs.flatMap((item) => {
    const subject = subjectNames.get(item.subject_id);
    return subject ? [{ id: item.id, title: item.title, subject, published: item.published }] : [];
  });
  const series: OwnedSeries[] = seriesDocs.flatMap((item) => {
    const subject = subjectNames.get(item.subject_id);
    return subject ? [{
      id: item.id,
      title: item.title,
      subject,
      published: item.published,
      reel_count: reelsBySeries.get(item.id) ?? 0,
    }] : [];
  });
  const seriesIds = new Set(seriesDocs.map((item) => item.id));
  const reels: OwnedReel[] = reelDocs.filter((item) => seriesIds.has(item.series_id))
    .sort((left, right) => (seriesNames.get(left.series_id) ?? "").localeCompare(seriesNames.get(right.series_id) ?? "")
      || left.sequence_number - right.sequence_number)
    .map((item) => ({
      id: item.id,
      title: item.title,
      sequence_number: item.sequence_number,
      published: item.published,
      series: seriesNames.get(item.series_id) ?? "",
    }));
  const batches = batchDocs.map(({ id, title }) => ({ id, title }));

  return (
    <>
      <PageMessages />
      <PageHeading eyebrow={user.role === "admin" ? "ADMIN CONTENT STUDIO" : "TEACHER CONTENT STUDIO"} title="Create something worth learning." description="Publish a full class or build a sequence of short educational reels." />
      {!subjects.length ? <div className="inline-notice">No subjects are assigned to your teacher account yet. Ask an administrator to assign your teaching subjects.</div> : (
        <div className="studio-grid">
          <section className="panel form-panel">
            <div className="form-panel-title"><span className="form-panel-icon violet"><span>01</span></span><div><span className="eyebrow">LONG-FORM LESSON</span><h2>Publish a class</h2></div></div>
            <form action={createClass} className="form-stack">
              <Field label="Class title" name="title" required placeholder="e.g. Introduction to algebra" />
              <label className="field"><span>Description</span><textarea name="description" rows={3} placeholder="What will students learn?" maxLength={1500} /></label>
              <label className="field"><span>Subject</span><select name="subjectId" required defaultValue=""><option value="" disabled>Select subject</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>
              <label className="field"><span>Restrict to batch (optional)</span><select name="batchId" defaultValue=""><option value="">All eligible students</option>{batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.title}</option>)}</select></label>
              <Field label="HTTPS video URL" name="videoUrl" type="url" required placeholder="https://your-video-host/lesson.mp4" />
              <Field label="Duration in seconds (optional)" name="durationSeconds" type="number" min={0} defaultValue={0} />
              {user.role === "teacher" && <label className="check-choice check-choice-wide"><input type="checkbox" name="published" /><span>Publish immediately</span></label>}
              <button className="button button-primary button-full" type="submit">Create class <span>→</span></button>
              <small className="form-hint">Use a direct HTTPS video URL compatible with HTML5 playback. Upload hosting is configured separately.</small>
            </form>
          </section>
          <div className="studio-column">
            <section className="panel form-panel">
              <div className="form-panel-title"><span className="form-panel-icon orange"><span>02</span></span><div><span className="eyebrow">SHORT-FORM SERIES</span><h2>Create a reel series</h2></div></div>
              <form action={createReelSeries} className="form-stack">
                <Field label="Series title" name="title" required placeholder="e.g. Algebra in 60 seconds" />
                <Field label="Topic (optional)" name="topic" placeholder="Algebra" />
                <label className="field"><span>Subject</span><select name="subjectId" required defaultValue=""><option value="" disabled>Select subject</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>
                <label className="field"><span>Restrict to batch (optional)</span><select name="batchId" defaultValue=""><option value="">All eligible students</option>{batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.title}</option>)}</select></label>
                <button className="button button-dark button-full" type="submit">Create series <span>→</span></button>
              </form>
            </section>
            <section className="panel form-panel">
              <div className="form-panel-title"><span className="form-panel-icon green"><span>03</span></span><div><span className="eyebrow">ADD A SHORT LESSON</span><h2>Publish a reel</h2></div></div>
              <form action={createReel} className="form-stack">
                <label className="field"><span>Series</span><select name="seriesId" required defaultValue=""><option value="" disabled>Select series</option>{series.map((item) => <option value={item.id} key={item.id}>#{item.id} · {item.title}</option>)}</select></label>
                <Field label="Reel title" name="title" required placeholder="One idea, clearly explained" />
                <label className="field"><span>Description</span><textarea name="description" rows={2} placeholder="A short summary" maxLength={1000} /></label>
                <Field label="HTTPS video URL" name="videoUrl" type="url" required placeholder="https://your-video-host/reel.mp4" />
                <div className="form-row"><Field label="Duration (seconds)" name="durationSeconds" type="number" required min={1} placeholder="60" /><Field label="Sequence number" name="sequenceNumber" type="number" required min={1} placeholder="1" /></div>
                <button className="button button-primary button-full" type="submit">Add reel to series <span>→</span></button>
              </form>
            </section>
          </div>
        </div>
      )}
      <section className="content-management-section">
        <div className="section-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h2>Content and publication</h2></div></div>
        {!classes.length && !series.length && !reels.length ? <div className="panel"><EmptyState title="Your content will show up here">Create your first class or series to get started.</EmptyState></div> : (
          <div className="content-admin-list">
            {classes.map((item) => <div className="content-admin-row" key={`class-${item.id}`}><span className="content-type-icon violet">CL</span><span className="content-admin-copy"><strong>{item.title}</strong><span>{item.subject} · Class</span></span><span className={`status-pill ${item.published ? "status-confirmed" : "status-draft"}`}>{item.published ? "Published" : "Draft"}</span><form action={togglePublication}><input type="hidden" name="entity" value="class" /><input type="hidden" name="id" value={item.id} /><button className="button button-small button-outline">{item.published ? "Unpublish" : "Publish"}</button></form></div>)}
            {series.map((item) => <div className="content-admin-row" key={`series-${item.id}`}><span className="content-type-icon orange">R{item.reel_count}</span><span className="content-admin-copy"><strong>{item.title}</strong><span>{item.subject} · {item.reel_count} reels · Series #{item.id}</span></span><span className={`status-pill ${item.published ? "status-confirmed" : "status-draft"}`}>{item.published ? "Published" : "Draft"}</span><form action={togglePublication}><input type="hidden" name="entity" value="series" /><input type="hidden" name="id" value={item.id} /><button className="button button-small button-outline">{item.published ? "Unpublish" : "Publish"}</button></form></div>)}
            {reels.map((item) => <div className="content-admin-row" key={`reel-${item.id}`}><span className="content-type-icon green">#{item.sequence_number}</span><span className="content-admin-copy"><strong>{item.title}</strong><span>{item.series} · Reel</span></span><span className={`status-pill ${item.published ? "status-confirmed" : "status-draft"}`}>{item.published ? "Published" : "Draft"}</span><form action={togglePublication}><input type="hidden" name="entity" value="reel" /><input type="hidden" name="id" value={item.id} /><button className="button button-small button-outline">{item.published ? "Unpublish" : "Publish"}</button></form></div>)}
          </div>
        )}
      </section>
      <section className="panel assigned-subjects"><span className="eyebrow">YOUR TEACHING SUBJECTS</span><div className="tag-list">{subjects.map((subject) => <span className="subject-tag" key={subject.id}>{subject.name}</span>)}</div></section>
    </>
  );
}
