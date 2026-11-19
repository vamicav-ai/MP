import { Field, PageHeading, PageMessages } from "@/components/ui";
import { changeOwnPassword } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  await requireUser();
  return (
    <>
      <PageMessages />
      <PageHeading
        eyebrow="ACCOUNT SECURITY"
        title="Change your password."
        description="Enter your current password and choose a new password with at least 10 characters."
      />
      <section className="panel">
        <form action={changeOwnPassword} className="form-stack">
          <Field label="Current password" name="currentPassword" type="password" required />
          <Field label="New password (10+ characters)" name="newPassword" type="password" required min={10} />
          <Field label="Confirm new password" name="confirmPassword" type="password" required min={10} />
          <button className="button button-primary" type="submit">Change password</button>
        </form>
      </section>
    </>
  );
}
