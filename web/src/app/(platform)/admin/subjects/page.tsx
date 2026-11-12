import { createSubject } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSubjects } from "@/lib/queries";

export default async function AdminSubjectsPage() {
  await requireUser(["admin"]);
  const subjects = await getSubjects();
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="SUBJECT CATALOG" title="Make room for curiosity." description="Subjects are the foundation for batches, classes, and reel series." />
      <div className="admin-split admin-split-narrow">
        <section className="panel form-panel">
          <div className="form-panel-title"><span className="form-panel-icon green"><span>+</span></span><div><span className="eyebrow">ADD TO THE CATALOG</span><h2>Create a subject</h2></div></div>
          <form action={createSubject} className="form-stack">
            <Field label="Subject name" name="name" required placeholder="e.g. Mathematics" />
            <label className="field"><span>Description</span><textarea name="description" rows={3} maxLength={500} placeholder="A short introduction for students" /></label>
            <button className="button button-primary button-full" type="submit">Add subject <span>→</span></button>
          </form>
        </section>
        <section>
          <div className="section-heading"><div><span className="eyebrow">AVAILABLE SUBJECTS</span><h2>{subjects.length} subjects</h2></div></div>
          {subjects.length ? <div className="subject-list">{subjects.map((subject, index) => <article className="subject-row" key={subject.id}><span className={`subject-symbol subject-symbol-${index % 4}`}>{subject.name.slice(0, 1)}</span><div><strong>{subject.name}</strong><span>{subject.description || "No description added yet."}</span></div><span className="status-pill status-confirmed">Active</span></article>)}</div> : <div className="panel"><EmptyState title="No subjects yet">Create the first subject to start building a learning catalog.</EmptyState></div>}
        </section>
      </div>
    </>
  );
}
