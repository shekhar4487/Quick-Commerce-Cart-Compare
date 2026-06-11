import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized, jsonError, remainingComparisons } from "@/lib/api";
import { PLATFORM_SLUGS } from "@/lib/platforms";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const [profile, remaining] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        plan: true,
        planExpiresAt: true,
        preferredPlatforms: true,
        notificationPrefs: true,
        firstOrderDone: true,
        createdAt: true,
        _count: { select: { comparisons: true, lists: true, cards: true } },
      },
    }),
    remainingComparisons(user),
  ]);
  if (!profile) return unauthorized();

  return NextResponse.json({ ...profile, remainingComparisons: remaining });
}

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, "Use +91XXXXXXXXXX format")
    .nullable()
    .optional(),
  preferredPlatforms: z.array(z.enum(PLATFORM_SLUGS as [string, ...string[]])).optional(),
  notificationPrefs: z
    .object({ whatsapp: z.boolean(), email: z.boolean(), dealAlerts: z.boolean() })
    .partial()
    .optional(),
  firstOrderDone: z.array(z.enum(PLATFORM_SLUGS as [string, ...string[]])).optional(),
});

export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid profile data.");

  const { notificationPrefs, ...rest } = parsed.data;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...rest,
      ...(notificationPrefs !== undefined ? { notificationPrefs } : {}),
    },
    select: { id: true, name: true, phone: true, preferredPlatforms: true, notificationPrefs: true, firstOrderDone: true },
  });

  return NextResponse.json(updated);
}
