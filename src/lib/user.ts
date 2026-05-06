import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

export async function getAuthUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (user) {
    // Decrypt sensitive fields transparently so all callers get plaintext
    if (user.groqApiKey) user.groqApiKey = decrypt(user.groqApiKey);
    if (user.apifyToken) user.apifyToken = decrypt(user.apifyToken);
  }

  return user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
