"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = pathname === "/login";

  useEffect(() => {
    if (status === "unauthenticated" && !isPublic) {
      router.push("/login");
    }
  }, [status, isPublic, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <h1 className="text-lg font-bold mb-2">
            <span className="text-accent">Job</span>Pilot AI
          </h1>
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
