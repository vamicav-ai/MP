import Link from "next/link";
import { redirect } from "next/navigation";
import { registerStudent } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { Field, PageMessages } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card auth-card-wide">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <div className="eyebrow">START LEARNING</div>
        <h1>Your next chapter starts here.</h1>
        <p className="auth-intro">Create your student account and build a learning routine that works for you.</p>
        <PageMessages />
        <form action={registerStudent} className="form-stack">
          <Field label="Full name" name="name" required placeholder="Your name" />
          <Field label="Email address" name="email" type="email" required placeholder="you@example.com" />
          <Field label="Mobile number" name="mobile" type="tel" required placeholder="+91 98765 43210" />
          <Field label="Password (10+ characters)" name="password" type="password" required min={10} placeholder="Create a password" />
          <Field label="Confirm password" name="confirmPassword" type="password" required min={10} placeholder="Repeat your password" />
          <button className="button button-primary button-full" type="submit">Create my account <span>→</span></button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        <p className="auth-footnote">We’ll send a verification link to your email before you can sign in. Use EduReels respectfully and keep your sign-in secure.</p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
