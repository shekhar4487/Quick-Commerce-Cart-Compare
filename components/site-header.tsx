"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { History, User, Crown, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const nav = [
    { href: "/history", label: "History", icon: History },
    { href: "/pricing", label: "Pro", icon: Crown },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <header className="border-b border-border bg-gradient-to-br from-[#0F1A12] to-background">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-lg">🛒</div>
          <div>
            <div className="text-[17px] font-bold tracking-tight leading-tight">CartCompare</div>
            <div className="text-xs text-[#5A7A5E] leading-tight">Quick commerce ka sabse sasta option</div>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {session?.user && (
            <>
              {session.user.plan === "PRO" && <Badge className="mr-1 hidden sm:inline-flex">PRO</Badge>}
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  className={cn(
                    "rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    pathname === href && "text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
              <button
                aria-label="Sign out"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
          {!session?.user && status !== "loading" && (
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">
              Sign in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
