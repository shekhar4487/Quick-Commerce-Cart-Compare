import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized, jsonError } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const lists = await prisma.groceryList.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, items: true, updatedAt: true },
  });
  return NextResponse.json({ lists });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  items: z.array(z.string().min(1).max(120)).min(1).max(30),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("A list needs a name and at least one item.");

  const count = await prisma.groceryList.count({ where: { userId: user.id } });
  if (count >= 50) return jsonError("List limit reached (50). Delete an old list first.");

  const list = await prisma.groceryList.create({
    data: { userId: user.id, name: parsed.data.name, items: parsed.data.items },
    select: { id: true, name: true, items: true, updatedAt: true },
  });
  return NextResponse.json(list, { status: 201 });
}
