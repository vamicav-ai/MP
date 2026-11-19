import { toggleBatch, createBatch } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages, SubjectChoices } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSubjects, money } from "@/lib/queries";
import type { BatchDocument, EnrollmentDocument, SubjectDocument } from "@/lib/models";

type BatchAdmin = { id: number; title: string; description: string; price_paise: number; is_free: number; published: number; subjects: string; enrollments: number };

export default async function AdminBatchesPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const [batchDocs, links, subjectDocs, enrollments] = await Promise.all([
    db.collection<BatchDocument>("batches").find().sort({ created_at: -1 }).toArray(),
    db.collection<{ batch_id: number; subject_id: number }>("batch_subjects").find().toArray(),
    db.collection<SubjectDocument>("subjects").find().toArray(),
    db.collection<EnrollmentDocument>("enrollments").find({ status: "active" }).toArray(),
  ]);
  const subjectNames = new Map(subjectDocs.map((subject) => [subject.id, subject.name]));
  const subjectIdsByBatch = new Map<number, number[]>();
  for (const link of links) {
    subjectIdsByBatch.set(link.batch_id, [...(subjectIdsByBatch.get(link.batch_id) ?? []), link.subject_id]);
  }
  const enrolledStudentsByBatch = new Map<number, Set<number>>();
  for (const enrollment of enrollments) {
    const students = enrolledStudentsByBatch.get(enrollment.batch_id) ?? new Set<number>();
    students.add(enrollment.student_id);
    enrolledStudentsByBatch.set(enrollment.batch_id, students);
  }
  const batches: BatchAdmin[] = batchDocs.map((batch) => ({
    id: batch.id,
    title: batch.title,
    description: batch.description,
    price_paise: batch.price_paise,
    is_free: batch.is_free,
    published: batch.published,
    subjects: (subjectIdsByBatch.get(batch.id) ?? [])
      .map((id) => subjectNames.get(id))
      .filter((name): name is string => Boolean(name))
      .join(", "),
    enrollments: enrolledStudentsByBatch.get(batch.id)?.size ?? 0,
  }));
  const subjects = await getSubjects();
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="BATCH MANAGEMENT" title="Learning paths with a plan." description="Create free or paid batches and attach them to one or more subjects." />
      <div className="admin-split">
        <section className="panel form-panel">
          <div className="form-panel-title"><span className="form-panel-icon orange"><span>+</span></span><div><span className="eyebrow">NEW LEARNING PATH</span><h2>Create a batch</h2></div></div>
          <form action={createBatch} className="form-stack">
            <Field label="Batch name" name="title" required placeholder="e.g. Mathematics Foundation" />
            <label className="field"><span>Description</span><textarea name="description" rows={3} maxLength={1000} placeholder="Who is this batch for?" /></label>
            <Field label="Price (INR — enter 0 for free)" name="price" type="number" min={0} required placeholder="0" />
            <div className="field"><span>Included subjects</span><SubjectChoices subjects={subjects} /></div>
            <button className="button button-primary button-full" type="submit">Create batch <span>→</span></button>
            <small className="form-hint">Paid batches use offline collection. Students stay locked out until an administrator confirms payment.</small>
          </form>
        </section>
        <section>
          <div className="section-heading"><div><span className="eyebrow">YOUR LEARNING PATHS</span><h2>{batches.length} batches</h2></div></div>
          {batches.length ? <div className="manage-list">{batches.map((batch) => <article className="manage-card" key={batch.id}><div className="manage-card-top"><div><span className="eyebrow">{batch.is_free ? "FREE ACCESS" : "OFFLINE PAYMENT"}</span><h3>{batch.title}</h3></div><strong>{batch.is_free ? "Free" : money(batch.price_paise)}</strong></div><p>{batch.description || "No description added yet."}</p><div className="manage-card-meta"><span>{batch.subjects || "No subjects"}</span><span>{batch.enrollments} enrolled</span><span className={`status-pill ${batch.published ? "status-confirmed" : "status-draft"}`}>{batch.published ? "Published" : "Unpublished"}</span></div><form action={toggleBatch}><input type="hidden" name="batchId" value={batch.id} /><button className="button button-small button-outline">{batch.published ? "Unpublish batch" : "Publish batch"}</button></form></article>)}</div> : <div className="panel"><EmptyState title="No batches yet">Create a batch to offer a structured learning path.</EmptyState></div>}
        </section>
      </div>
    </>
  );
}
