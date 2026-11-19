import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

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
        <h1>Need help signing in?</h1>
        <p className="auth-intro">EduReels does not send password reset emails. If you know your current password, sign in and change it from Account.</p>
        <p className="auth-intro">If you have forgotten your password, contact an administrator and ask them to reset it. Never share your password by email or chat.</p>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
