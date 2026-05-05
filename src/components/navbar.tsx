"use client";

import { db } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export function Navbar() {
  const { user } = db.useAuth();

  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="w-full px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-tight">
          WatchTower
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => db.auth.signOut()}
              >
                Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
