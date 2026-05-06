import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";

export async function GET() {
  try {
    const user = await requireAuth();

    const applications = await prisma.application.findMany({
      where: { userId: user.id },
      include: { job: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ applications });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { id, status, notes } = await req.json();

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === "applied") updateData.appliedAt = new Date();
    }
    if (notes !== undefined) updateData.notes = notes;

    const application = await prisma.application.update({
      where: { id, userId: user.id },
      data: updateData,
      include: { job: true },
    });

    return NextResponse.json({ application });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { id } = await req.json();
    await prisma.application.delete({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
