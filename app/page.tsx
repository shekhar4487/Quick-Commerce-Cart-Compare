import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CompareWizard } from "@/components/wizard/compare-wizard";
import { PLATFORMS, getBank } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) return <Landing />;

  const [cards, lists] = await Promise.all([
    prisma.userCard.findMany({
      where: { userId: session.user.id },
      select: { bankId: true, cardName: true, cardType: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.groceryList.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, items: true },
    }),
  ]);

  return (
    <CompareWizard
      initialCards={cards.map((c) => ({ ...c, bankName: getBank(c.bankId)?.name }))}
      initialLists={lists.map((l) => ({ id: l.id, name: l.name, items: (l.items as string[]) ?? [] }))}
      plan={session.user.plan}
    />
  );
}

function Landing() {
  return (
    <div className="py-8">
      <h1 className="mb-3 text-3xl font-extrabold leading-tight tracking-tight">
        Wahi groceries.
        <br />
        <span className="text-primary">Sabse sasta app.</span>
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
        Enter your grocery list once — CartCompare checks live prices, delivery fees aur aapke bank card
        offers across all 4 quick-commerce apps, and tells you exactly where to order.
      </p>

      <div className="mb-8 flex flex-col gap-2.5">
        {PLATFORMS.map((p) => (
          <div key={p.slug} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-sm font-medium">{p.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {p.deliveryFee === 0 ? "Free delivery" : `₹${p.deliveryFee} delivery`}
            </span>
          </div>
        ))}
      </div>

      <ul className="mb-8 space-y-2.5 text-sm text-foreground/80">
        <li>💳 Apne HDFC / SBI / ICICI / Axis cards add karo — eligible offers auto-apply</li>
        <li>🔄 Live prices, scraped fresh every 15 minutes</li>
        <li>🏆 Effective total = price + delivery − best offer. No surprises at checkout.</li>
        <li>⚡ Pro: one tap aur items winning app ke cart mein</li>
      </ul>

      <Link
        href="/login"
        className="block w-full rounded-lg bg-primary py-4 text-center text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Start comparing — it&apos;s free →
      </Link>
      <p className="mt-3 text-center text-xs text-muted-foreground/60">
        5 free comparisons every month. No card required.
      </p>
    </div>
  );
}
