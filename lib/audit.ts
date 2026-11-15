import { withEvent } from "./db";

export async function audit(
  eventId: number,
  action: string,
  detail: string,
  actor = "system",
  ip = "",
): Promise<void> {
  await withEvent(eventId, (tx) =>
    tx`insert into audit_logs (event_id, action, detail, actor, ip)
        values (${eventId}, ${action}, ${detail}, ${actor}, ${ip})`,
  );
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "";
}
