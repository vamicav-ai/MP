import Link from "next/link";
import { redirect } from "next/navigation";
import { provisionFirstAdmin } from "@/lib/actions";
import { initializeDatabase } from "@/lib/db";
import { countDocuments } from "@/lib/queries";
import { Field, PageMessages } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await initializeDatabase();
  const count = await countDocuments("users");
  if (count) redirect("/login");
  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <div className="eyebrow">YOUR LEARNING PLATFORM</div>
        <h1>Set up your learning space</h1>
        <p className="auth-intro">Create the first administrator account. This one-time setup is only available while the platform has no users.</p>
        <PageMessages />
        <form action={provisionFirstAdmin} className="form-stack">
          <Field label="Your name" name="name" required placeholder="Aarav Sharma" />
          <Field label="Email address" name="email" type="email" required placeholder="you@example.com" />
          <Field label="Mobile number" name="mobile" type="tel" required placeholder="+91 98765 43210" />
          <Field label="Password (12+ characters)" name="password" type="password" required min={12} placeholder="Create a strong password" />
          <button className="button button-primary button-full" type="submit">Create admin account <span>→</span></button>
        </form>
        <p className="auth-footnote">Store your password safely. EduReels never stores your password in plain text.</p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
