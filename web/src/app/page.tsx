import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Check, Clapperboard, Compass, Play } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const features = [
  {
    icon: BookOpen,
    title: "Learn the whole idea",
    description: "Settle into full-length classes when a subject deserves a deeper look.",
    className: "landing-feature-green",
  },
  {
    icon: Clapperboard,
    title: "Keep lessons in reach",
    description: "Follow short, ordered reels and pick up from the next unfinished lesson.",
    className: "landing-feature-orange",
  },
  {
    icon: Compass,
    title: "Make learning yours",
    description: "Choose your subjects, join a batch, and keep track of your progress.",
    className: "landing-feature-violet",
  },
];

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="brand" href="/" aria-label="EduReels home">
          <span className="brand-mark">e</span>
          <span>edu<span className="brand-accent">reels</span></span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <Link className="landing-signin" href="/login">Sign in</Link>
          <Link className="button button-primary" href="/register">Start learning <ArrowRight size={16} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><span /> A little progress, every day</span>
          <h1>Big ideas.<br /><span>One step at a time.</span></h1>
          <p>Learn with thoughtful classes, short educational reels, and a clear path to keep moving forward.</p>
          <div className="landing-actions">
            <Link className="button button-primary" href="/register">Create your free account <ArrowRight size={16} /></Link>
            <Link className="landing-secondary-link" href="/login">I already have an account</Link>
          </div>
          <div className="landing-proof"><span><Check size={14} /> Learn at your own pace</span><span><Check size={14} /> Your progress stays saved</span></div>
        </div>
        <div className="landing-preview" aria-label="Preview of a learning dashboard">
          <div className="landing-preview-top"><span className="landing-preview-dot" /><span>YOUR LEARNING SPACE</span><span className="landing-preview-avatar">A</span></div>
          <div className="landing-preview-greeting"><span>YOUR NEXT CHAPTER</span><strong>Keep your curiosity<br />moving forward.</strong><p>A little progress every day adds up.</p></div>
          <div className="landing-preview-progress"><div className="landing-preview-progress-icon"><Play size={16} fill="currentColor" /></div><div><span>CONTINUE LEARNING</span><strong>Ideas in small steps</strong><small>Reel 03 · 68% watched</small></div><div className="landing-preview-ring">68%</div></div>
          <div className="landing-preview-subjects"><span>YOUR SUBJECTS</span><div><i>Mathematics</i><i>Physics</i><i>Biology</i></div></div>
          <div className="landing-preview-decoration landing-preview-decoration-one" />
          <div className="landing-preview-decoration landing-preview-decoration-two" />
        </div>
      </section>

      <section className="landing-features" aria-labelledby="landing-features-title">
        <div className="landing-section-heading"><span className="eyebrow">A BETTER WAY TO LEARN</span><h2 id="landing-features-title">Build a rhythm that works for you.</h2><p>Go deep, take a quick lesson, and come back right where you left off.</p></div>
        <div className="landing-feature-grid">
          {features.map(({ icon: Icon, title, description, className }, index) => (
            <article className="landing-feature-card" key={title}>
              <span className={`landing-feature-icon ${className}`}><Icon size={20} /></span>
              <span className="landing-feature-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <Link className="brand" href="/"><span className="brand-mark">e</span><span>edu<span className="brand-accent">reels</span></span></Link>
        <span>Learning, one good step at a time.</span>
      </footer>
    </main>
  );
}
