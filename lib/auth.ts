import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// a single admin with the password in .env; switch to per-business users if there are several owners.
const token = () => createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update("admin").digest("hex");

export function checkPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(pw), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function login() {
  (await cookies()).set("admin", token(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7 });
}

export async function logout() {
  (await cookies()).delete("admin");
}

export async function isAdmin() {
  return !!process.env.ADMIN_PASSWORD && (await cookies()).get("admin")?.value === token();
}
