import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

const COOKIE_NAME = "ntop_session";
type Session = { id: string; email: string; name: string; role: Role };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(key());
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
}

export async function clearSession() { (await cookies()).delete(COOKIE_NAME); }

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const claims = (await jwtVerify(token, key())).payload as unknown as Session;
    const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { id: true, email: true, name: true, role: true, active: true } });
    if (!user?.active) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  } catch { return null; }
}

export async function requireSession() { const session = await getSession(); if (!session) redirect("/login"); return session; }
export const isAdmin = (role: Role) => role === "ADMIN";
export const sessionCookieName = COOKIE_NAME;
