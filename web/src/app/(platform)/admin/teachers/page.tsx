import { createTeacher, toggleTeacher } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages, SubjectChoices } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSubjects } from "@/lib/queries";

type Teacher = { id: number; name: string; email: string; mobile: string; active: number; subjects: string };

export default async function AdminTeachersPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const subjects = await getSubjects();
  const teachers = await db.prepare(`
    SELECT users.id, users.name, users.email, users.mobile, users.active,
      COALESCE(group_concat(subjects.name, ', '), '') AS subjects
    FROM users LEFT JOIN teacher_subjects ON teacher_subjects.teacher_id = users.id
    LEFT JOIN subjects ON subjects.id = teacher_subjects.subject_id
    WHERE users.role = 'teacher' GROUP BY users.id ORDER BY users.created_at DESC
  `).all() as Teacher[];
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
