import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { Field, PageMessages } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <div className="eyebrow">ACCOUNT RECOVERY</div>
        <h1>Let’s get you back in.</h1>
        <p className="auth-intro">Enter your account email. If it’s registered, we’ll send a secure password reset link.</p>
        <PageMessages />
        <form action={requestPasswordReset} className="form-stack">
          <Field label="Email address" name="email" type="email" required placeholder="you@example.com" />
          <button className="button button-primary button-full" type="submit">Send reset link <span>→</span></button>
        </form>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
