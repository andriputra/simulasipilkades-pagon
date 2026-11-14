import { sql } from "./db";

export async function audit(action: string, detail: string, actor = "system", ip = ""): Promise<void> {
  await sql`insert into audit_logs (action, detail, actor, ip) values (${action}, ${detail}, ${actor}, ${ip})`;
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "";
}
