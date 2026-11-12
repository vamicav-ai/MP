import Link from "next/link";
import { verifyEmail } from "@/lib/actions";
import { PageMessages } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <div className="eyebrow">EMAIL VERIFICATION</div>
        <h1>Confirm it’s really you.</h1>
        <p className="auth-intro">Verify your email address to activate your student account. Verification links expire after 24 hours.</p>
        <PageMessages />
        {token ? (
          <form action={verifyEmail} className="form-stack">
            <input type="hidden" name="token" value={token} />
            <button className="button button-primary button-full" type="submit">Verify email <span>→</span></button>
          </form>
        ) : <p className="flash flash-error">This verification link is missing its token.</p>}
        <p className="auth-switch"><Link href="/login">Go to sign in</Link></p>
      </section>
      <div className="auth-caption">LEARN SOMETHING NEW, EVERY DAY.</div>
    </main>
  );
}
