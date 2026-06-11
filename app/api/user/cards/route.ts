import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized, jsonError } from "@/lib/api";
import { BANKS } from "@/lib/platforms";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const cards = await prisma.userCard.findMany({
    where: { userId: user.id },
    select: { id: true, bankId: true, cardName: true, cardType: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ cards });
}

const cardSchema = z.object({
  bankId: z.enum(BANKS.map((b) => b.id) as [string, ...string[]]),
  cardName: z.string().min(1).max(60),
  cardType: z.enum(["CREDIT", "DEBIT"]).default("CREDIT"),
});

const putSchema = z.object({ cards: z.array(cardSchema).max(20) });

/** Replaces the user's saved card set (the UI always sends the full list). */
export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid cards payload.");

  // Dedupe on bank+card name.
  const unique = new Map<string, (typeof parsed.data.cards)[number]>();
  for (const c of parsed.data.cards) unique.set(`${c.bankId}:${c.cardName}`, c);

  await prisma.$transaction([
    prisma.userCard.deleteMany({ where: { userId: user.id } }),
    prisma.userCard.createMany({
      data: Array.from(unique.values()).map((c) => ({ ...c, userId: user.id })),
    }),
  ]);

  const cards = await prisma.userCard.findMany({
    where: { userId: user.id },
    select: { id: true, bankId: true, cardName: true, cardType: true },
  });
  return NextResponse.json({ cards });
}
