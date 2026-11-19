import { redirect } from "next/navigation";
import { chooseSubjects } from "@/lib/actions";
import { PageHeading, PageMessages, SubjectChoices } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSubjects } from "@/lib/queries";

export default async function SubjectsPage() {
  const user = await requireUser(["student"]);
  const selected = await getDb().collection<{ student_id: number; subject_id: number }>("student_subjects")
    .find({ student_id: user.id }, { projection: { subject_id: 1 } }).toArray();
  const subjects = await getSubjects();
  if (!subjects.length) redirect("/dashboard?error=No%20subjects%20are%20available%20yet");
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="PERSONALIZE YOUR FEED" title="What are you curious about?" description="Pick the subjects you want to see. You can update your choices whenever you like." />
      <form className="subject-selection-panel" action={chooseSubjects}>
        <SubjectChoices subjects={subjects} selected={selected.map((item) => item.subject_id)} />
        <div className="form-footer"><span>Your selections help us surface more relevant classes and reels.</span><button className="button button-primary" type="submit">Save my subjects <span>→</span></button></div>
      </form>
    </>
  );
}
