import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized, jsonError } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  // deleteMany so the userId filter makes this ownership-safe.
  const result = await prisma.groceryList.deleteMany({
    where: { id: params.id, userId: user.id },
  });
  if (result.count === 0) return jsonError("List not found.", 404);

  return NextResponse.json({ ok: true });
}
