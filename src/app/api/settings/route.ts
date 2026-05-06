import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json({
      name: user.name || "",
      email: user.email || "",
      groqApiKey: user.groqApiKey ? "••••••" + user.groqApiKey.slice(-4) : "",
      hasGroqKey: !!user.groqApiKey,
      hasApiKey: !!user.groqApiKey,
      apifyToken: user.apifyToken ? "••••••" + user.apifyToken.slice(-4) : "",
      hasApifyToken: !!user.apifyToken,
      resumeFileName: user.resumeFileName,
      resumeUrl: user.resumeUrl || "",
      hasResume: !!user.resumeText,
      preferredRoles: user.preferredRoles,
      preferredLocations: user.preferredLocations,
      experienceMonths: user.experienceMonths,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.groqApiKey !== undefined) updateData.groqApiKey = body.groqApiKey ? encrypt(body.groqApiKey) : "";
    if (body.apifyToken !== undefined) updateData.apifyToken = body.apifyToken ? encrypt(body.apifyToken) : "";
    if (body.preferredRoles !== undefined) updateData.preferredRoles = body.preferredRoles;
    if (body.preferredLocations !== undefined) updateData.preferredLocations = body.preferredLocations;
    if (body.experienceMonths !== undefined) updateData.experienceMonths = body.experienceMonths;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      hasApiKey: !!updated.groqApiKey,
      hasApifyToken: !!updated.apifyToken,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
