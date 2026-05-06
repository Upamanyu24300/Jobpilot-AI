"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "⊞" },
  { href: "/jobs", label: "Job Search", icon: "⊙" },
  { href: "/sample-apply", label: "Sample Apply", icon: "▶" },
  { href: "/applications", label: "Applications", icon: "◎" },
  { href: "/automation", label: "Automation", icon: "⟳" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col h-screen">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-accent">Job</span>Pilot AI
        </h1>
        <p className="text-xs text-muted mt-0.5">Automated Job Applications</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-4 border-t border-border">
        {session?.user && (
          <div className="flex items-center gap-3 mb-3">
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted truncate">
                {session.user.email}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs text-muted hover:text-red-400 transition-colors text-left"
        >
          Sign out
        </button>
        <p className="text-xs text-muted mt-2">Powered by Groq + Llama 3.3</p>
      </div>
    </aside>
  );
}
