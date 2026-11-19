"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  KeyRound,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { signOut } from "@/lib/actions";
import type { Role, User } from "@/lib/auth";

const studentLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/subjects", label: "My subjects", icon: LibraryBig },
  { href: "/batches", label: "Explore batches", icon: GraduationCap },
  { href: "/classes", label: "Video classes", icon: BookOpen },
  { href: "/reels", label: "Learning reels", icon: Clapperboard },
  { href: "/progress", label: "My progress", icon: ArrowUpRight },
];

const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: UsersRound },
  { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
  { href: "/admin/subjects", label: "Subjects", icon: LibraryBig },
  { href: "/admin/batches", label: "Batches", icon: BookOpen },
  { href: "/admin/content", label: "Content", icon: Clapperboard },
  { href: "/admin/payments", label: "Offline payments", icon: ShieldCheck },
];

const teacherLinks = [
  { href: "/teacher", label: "Overview", icon: LayoutDashboard },
  { href: "/teacher/content", label: "My content", icon: Clapperboard },
];

function linksFor(role: Role) {
  if (role === "admin") return adminLinks;
  if (role === "teacher") return teacherLinks;
  return studentLinks;
}

export function AppFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [...linksFor(user.role), { href: "/account", label: "Account", icon: KeyRound }];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="EduReels home">
          <span className="brand-mark">e</span>
          <span>edu<span className="brand-accent">reels</span></span>
        </Link>
        <div className="workspace-label">LEARNING SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && href !== "/admin" && href !== "/teacher" && pathname.startsWith(`${href}/`));
            return (
              <Link className={`nav-link ${active ? "nav-link-active" : ""}`} href={href} key={href}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><ShieldCheck size={17} /></div>
            <div><strong>Keep learning</strong><span>Your progress is saved automatically.</span></div>
          </div>
          <div className="user-mini">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="user-mini-copy"><strong>{user.name}</strong><span>{user.role}</span></div>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">EduReels <span>/</span> {user.role === "admin" ? "Administration" : user.role === "teacher" ? "Teaching" : "Learning"}</div>
          <div className="topbar-right">
            <span className={`role-pill role-${user.role}`}>{user.role}</span>
            <div className="avatar avatar-small">{user.name.slice(0, 1).toUpperCase()}</div>
            <form action={signOut}>
              <button className="icon-button" aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
            </form>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
