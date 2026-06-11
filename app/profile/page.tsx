"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CardSetup } from "@/components/wizard/card-setup";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCards } from "@/hooks/use-cards";
import { PLATFORMS } from "@/lib/platforms";
import type { UserCardInput } from "@/types";

interface Profile {
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: "FREE" | "PRO";
  preferredPlatforms: string[];
  notificationPrefs: { whatsapp?: boolean; email?: boolean; dealAlerts?: boolean } | null;
  remainingComparisons: number | null;
}

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialCards, setInitialCards] = useState<UserCardInput[] | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/profile");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const [profileRes, cardsRes] = await Promise.all([fetch("/api/user/profile"), fetch("/api/user/cards")]);
      if (profileRes.ok) setProfile(await profileRes.json());
      if (cardsRes.ok) setInitialCards((await cardsRes.json()).cards);
    })();
  }, [status]);

  if (status === "loading" || !profile || initialCards === null) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return <ProfileForm profile={profile} initialCards={initialCards} />;
}

function ProfileForm({ profile, initialCards }: { profile: Profile; initialCards: UserCardInput[] }) {
  const { cards, setCards, persist, saving } = useCards(initialCards);
  const [platforms, setPlatforms] = useState<string[]>(
    profile.preferredPlatforms.length ? profile.preferredPlatforms : PLATFORMS.map((p) => p.slug)
  );
  const [prefs, setPrefs] = useState({
    whatsapp: profile.notificationPrefs?.whatsapp ?? false,
    email: profile.notificationPrefs?.email ?? true,
    dealAlerts: profile.notificationPrefs?.dealAlerts ?? false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const saveCards = async () => {
    (await persist(cards)) ? toast.success("Cards saved") : toast.error("Could not save cards.");
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredPlatforms: platforms, notificationPrefs: prefs }),
      });
      res.ok ? toast.success("Preferences saved") : toast.error((await res.json()).error ?? "Save failed.");
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const togglePlatform = (slug: string) => {
    setPlatforms((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      return next.length === 0 ? prev : next; // at least one platform stays on
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Account */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-tight">Profile</h1>
          <Badge variant={profile.plan === "PRO" ? "default" : "muted"}>{profile.plan}</Badge>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="text-foreground">{profile.name ?? "CartCompare user"}</div>
          <div className="text-muted-foreground">{profile.email ?? profile.phone}</div>
          {profile.remainingComparisons !== null && (
            <div className="mt-2 text-xs text-muted-foreground/70">
              {profile.remainingComparisons} free comparisons left this month ·{" "}
              <a href="/pricing" className="text-primary hover:underline">
                Upgrade
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Cards */}
      <section>
        <CardSetup cards={cards} onChange={setCards} />
        <Button className="mt-4 w-full" onClick={saveCards} disabled={saving}>
          {saving ? "Saving…" : "Save cards"}
        </Button>
      </section>

      {/* Platforms */}
      <section>
        <h2 className="mb-1 text-lg font-bold">Delivery apps</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">Jo apps aap use nahi karte, unhe off kar do.</p>
        <div className="flex flex-col gap-2">
          {PLATFORMS.map((p) => (
            <div key={p.slug} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className="text-sm">{p.name}</span>
              </div>
              <Switch checked={platforms.includes(p.slug)} onCheckedChange={() => togglePlatform(p.slug)} aria-label={p.name} />
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="mb-1 text-lg font-bold">Notifications</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">Best deals aur price drops ke alerts.</p>
        <div className="flex flex-col gap-2">
          {(
            [
              ["whatsapp", "WhatsApp alerts"],
              ["email", "Email alerts"],
              ["dealAlerts", "Weekly deal digest (Pro)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <span className="text-sm">{label}</span>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                disabled={key === "dealAlerts" && profile.plan !== "PRO"}
                aria-label={label}
              />
            </div>
          ))}
        </div>
        <Button className="mt-4 w-full" onClick={savePrefs} disabled={savingPrefs}>
          {savingPrefs ? "Saving…" : "Save preferences"}
        </Button>
      </section>
    </div>
  );
}
