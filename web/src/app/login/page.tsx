import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { countDocuments } from "@/lib/queries";
import { Field, PageMessages } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  await initializeDatabase();
  const count = await countDocuments("users");
  if (!count) redirect("/setup");
  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Pick up where you left off.</h1>
        <p className="auth-intro">Sign in to your learning space and keep making progress.</p>
        <PageMessages />
        <form action={signIn} className="form-stack">
          <Field label="Email or mobile number" name="identifier" required placeholder="you@example.com" />
          <Field label="Password" name="password" type="password" required placeholder="Your password" />
          <button className="button button-primary button-full" type="submit">Sign in <span>→</span></button>
        </form>
        <p className="auth-switch">New to EduReels? <Link href="/register">Create a student account</Link></p>
        <p className="auth-footnote"><Link href="/forgot-password">Forgot your password? Contact an administrator.</Link></p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
