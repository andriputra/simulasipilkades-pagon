import { cookies } from "next/headers";
import { verifyToken } from "./auth";

export const ADMIN_COOKIE = "pilkades_admin";

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token) === "admin";
}
