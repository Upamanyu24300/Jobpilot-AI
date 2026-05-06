"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { AuthGuard } from "./auth-guard";

const NO_SHELL_PATHS = ["/login", "/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const onboardingChecked = useRef(false);

  const isShellless = NO_SHELL_PATHS.includes(pathname);
  const isAuthed = status === "authenticated";

  // Once authenticated, check if the user has completed onboarding.
  // Only run once per mount to avoid repeated fetches on every navigation.
  useEffect(() => {
    if (!isAuthed || isShellless || onboardingChecked.current) return;
    onboardingChecked.current = true;

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasGroqKey || !data.hasApifyToken || !data.hasResume) {
          router.replace("/onboarding");
        }
      })
      .catch(() => {/* non-fatal — let the user proceed */});
  }, [isAuthed, isShellless, router]);

  return (
    <AuthGuard>
      {isShellless || !isAuthed ? (
        <>{children}</>
      ) : (
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
