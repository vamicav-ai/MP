import { createTeacher, toggleTeacher } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages, SubjectChoices } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSubjects } from "@/lib/queries";
import type { SubjectDocument, UserDocument } from "@/lib/models";

type Teacher = { id: number; name: string; email: string; mobile: string; active: number; subjects: string };

export default async function AdminTeachersPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const subjects = await getSubjects();
  const [teacherDocs, assignments, subjectDocs] = await Promise.all([
    db.collection<UserDocument>("users").find({ role: "teacher" }).sort({ created_at: -1 }).toArray(),
    db.collection<{ teacher_id: number; subject_id: number }>("teacher_subjects").find().toArray(),
    db.collection<SubjectDocument>("subjects").find().toArray(),
  ]);
  const subjectNames = new Map(subjectDocs.map((subject) => [subject.id, subject.name]));
  const subjectIdsByTeacher = new Map<number, number[]>();
  for (const assignment of assignments) {
    subjectIdsByTeacher.set(assignment.teacher_id, [...(subjectIdsByTeacher.get(assignment.teacher_id) ?? []), assignment.subject_id]);
  }
  const teachers: Teacher[] = teacherDocs.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    mobile: teacher.mobile,
    active: teacher.active,
    subjects: (subjectIdsByTeacher.get(teacher.id) ?? [])
      .map((id) => subjectNames.get(id))
      .filter((name): name is string => Boolean(name))
      .join(", "),
  }));
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="TEACHER ACCOUNTS" title="The people who make learning happen." description="Create teacher logins and assign the subjects they can teach." />
      <div className="admin-split">
        <section className="panel form-panel">
          <div className="form-panel-title"><span className="form-panel-icon violet"><span>+</span></span><div><span className="eyebrow">NEW ACCOUNT</span><h2>Create a teacher</h2></div></div>
          <form action={createTeacher} className="form-stack">
            <Field label="Full name" name="name" required placeholder="Teacher name" />
            <Field label="Email address" name="email" type="email" required placeholder="teacher@example.com" />
            <Field label="Mobile number" name="mobile" type="tel" required placeholder="+91 98765 43210" />
            <Field label="Temporary password (12+ characters)" name="password" type="password" required min={12} placeholder="Share securely with the teacher" />
            <div className="field"><span>Assigned subjects</span><SubjectChoices subjects={subjects} /></div>
            <button className="button button-primary button-full" type="submit">Create teacher account <span>→</span></button>
            <small className="form-hint">The temporary password is never shown again after account creation. Send it to the teacher securely.</small>
          </form>
        </section>
        <section>
          <div className="section-heading"><div><span className="eyebrow">YOUR EDUCATORS</span><h2>{teachers.length} teacher{teachers.length === 1 ? "" : "s"}</h2></div></div>
          {teachers.length ? <div className="people-list">{teachers.map((teacher) => <article className="person-card" key={teacher.id}><div className="person-avatar">{teacher.name.slice(0, 1).toUpperCase()}</div><div className="person-copy"><strong>{teacher.name}</strong><span>{teacher.email}</span><small>{teacher.subjects || "No subjects assigned"} · {teacher.mobile}</small></div><div className="person-actions"><span className={`status-pill ${teacher.active ? "status-confirmed" : "status-draft"}`}>{teacher.active ? "Active" : "Suspended"}</span><form action={toggleTeacher}><input type="hidden" name="teacherId" value={teacher.id} /><button className="button button-small button-outline">{teacher.active ? "Suspend" : "Activate"}</button></form></div></article>)}</div> : <div className="panel"><EmptyState title="No teachers yet">Create a teacher account and give them subjects to teach.</EmptyState></div>}
        </section>
      </div>
    </>
  );
}
