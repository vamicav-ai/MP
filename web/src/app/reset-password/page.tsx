import Link from "next/link";
import { resetPassword } from "@/lib/actions";
import { Field, PageMessages } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <div className="eyebrow">SET A NEW PASSWORD</div>
        <h1>Choose a fresh start.</h1>
        <p className="auth-intro">Use a password of at least 10 characters. Reset links expire after one hour and can only be used once.</p>
        <PageMessages />
        {token ? (
          <form action={resetPassword} className="form-stack">
            <input type="hidden" name="token" value={token} />
            <Field label="New password (10+ characters)" name="password" type="password" required min={10} />
            <Field label="Confirm new password" name="confirmPassword" type="password" required min={10} />
            <button className="button button-primary button-full" type="submit">Reset password <span>→</span></button>
          </form>
        ) : <p className="flash flash-error">This password reset link is missing its token.</p>}
        <p className="auth-switch"><Link href="/forgot-password">Request another reset link</Link></p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
