import { resetStudentPassword, resetStudentProgress } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type {
  EnrollmentDocument,
  ReelProgressDocument,
  SessionDocument,
  UserDocument,
} from "@/lib/models";

type Student = { id: number; name: string; email: string; mobile: string; created_at: string | Date; batch_count: number; completed_reels: number; active_session: string | null };

export default async function AdminStudentsPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const [userDocs, enrollments, reelProgress, sessions] = await Promise.all([
    db.collection<UserDocument>("users").find({ role: "student" }).sort({ created_at: -1 }).toArray(),
    db.collection<EnrollmentDocument>("enrollments").find({ status: "active" }).toArray(),
    db.collection<ReelProgressDocument>("reel_progress").find({ completed: 1 }).toArray(),
    db.collection<SessionDocument>("sessions").find({ expires_at: { $gt: new Date() } }).toArray(),
  ]);
  const batchIdsByStudent = new Map<number, Set<number>>();
  for (const enrollment of enrollments) {
    const batchIds = batchIdsByStudent.get(enrollment.student_id) ?? new Set<number>();
    batchIds.add(enrollment.batch_id);
    batchIdsByStudent.set(enrollment.student_id, batchIds);
  }
  const completedByStudent = new Map<number, Set<number>>();
  for (const progress of reelProgress) {
    const reelIds = completedByStudent.get(progress.student_id) ?? new Set<number>();
    reelIds.add(progress.reel_id);
    completedByStudent.set(progress.student_id, reelIds);
  }
  const activeSessions = new Set(sessions.map((session) => session.user_id));
  const students: Student[] = userDocs.map((student) => ({
    id: student.id,
    name: student.name,
    email: student.email,
    mobile: student.mobile,
    created_at: student.created_at,
    batch_count: batchIdsByStudent.get(student.id)?.size ?? 0,
    completed_reels: completedByStudent.get(student.id)?.size ?? 0,
    active_session: activeSessions.has(student.id) ? "active" : null,
  }));
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="STUDENT DIRECTORY" title="Learners on the platform." description="View enrollments and progress, or help a student regain access by resetting their password." />
      {students.length ? <div className="student-table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Joined</th><th>Active batches</th><th>Reels completed</th><th>Session</th><th>Support</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><span>{student.email}</span><small>{student.mobile}</small></td><td>{new Date(student.created_at).toLocaleDateString("en-IN")}</td><td>{student.batch_count}</td><td>{student.completed_reels}</td><td><span className={`session-status ${student.active_session ? "session-active" : ""}`} />{student.active_session ? "Active" : "Signed out"}</td><td><div className="form-stack"><form action={resetStudentProgress}><input type="hidden" name="studentId" value={student.id} /><button className="button button-small button-outline" type="submit">Reset progress</button></form><details><summary>Reset password</summary><form action={resetStudentPassword} className="form-stack"><input type="hidden" name="studentId" value={student.id} /><Field label="New password (10+ characters)" name="newPassword" type="password" required min={10} /><Field label="Confirm new password" name="confirmPassword" type="password" required min={10} /><button className="button button-small button-outline" type="submit">Set password</button><small>Share the new password directly and ask the student to change it after signing in.</small></form></details></div></td></tr>)}</tbody></table></div> : <div className="panel"><EmptyState title="No students yet">Student accounts will appear here after registration.</EmptyState></div>}
    </>
  );
}
