import { resetStudentProgress } from "@/lib/actions";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Student = { id: number; name: string; email: string; mobile: string; created_at: string; batch_count: number; completed_reels: number; active_session: string | null };

export default async function AdminStudentsPage() {
  await requireUser(["admin"]);
  const students = await getDb().prepare(`
    SELECT users.id, users.name, users.email, users.mobile, users.created_at,
      COUNT(DISTINCT CASE WHEN enrollments.status = 'active' THEN enrollments.batch_id END) AS batch_count,
      COUNT(DISTINCT CASE WHEN reel_progress.completed = 1 THEN reel_progress.reel_id END) AS completed_reels,
      MAX(sessions.device_id) AS active_session
    FROM users
    LEFT JOIN enrollments ON enrollments.student_id = users.id
    LEFT JOIN reel_progress ON reel_progress.student_id = users.id
    LEFT JOIN sessions ON sessions.user_id = users.id AND sessions.expires_at > ?
    WHERE users.role = 'student'
    GROUP BY users.id ORDER BY users.created_at DESC
  `).all(new Date().toISOString()) as Student[];
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="STUDENT DIRECTORY" title="Learners on the platform." description="View enrollments and progress. Reset progress only when a student needs help." />
      {students.length ? <div className="student-table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Joined</th><th>Active batches</th><th>Reels completed</th><th>Session</th><th>Support</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><span>{student.email}</span><small>{student.mobile}</small></td><td>{new Date(student.created_at).toLocaleDateString("en-IN")}</td><td>{student.batch_count}</td><td>{student.completed_reels}</td><td><span className={`session-status ${student.active_session ? "session-active" : ""}`} />{student.active_session ? "Active" : "Signed out"}</td><td><form action={resetStudentProgress}><input type="hidden" name="studentId" value={student.id} /><button className="button button-small button-outline" type="submit">Reset progress</button></form></td></tr>)}</tbody></table></div> : <div className="panel"><EmptyState title="No students yet">Student accounts will appear here after registration.</EmptyState></div>}
    </>
  );
}
