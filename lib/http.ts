import { NextResponse } from "next/server";
import { isAdminForEvent } from "./admin";
import { findEventBySlug, type EventRow } from "./event";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

type RouteParams = { slug: string } & Record<string, string>;
type RouteCtx = { params: Promise<RouteParams> };
type Handler = (ev: EventRow, req: Request, ctx: RouteCtx) => Promise<NextResponse>;

async function resolveEvent(ctx: RouteCtx): Promise<EventRow> {
  const { slug } = await ctx.params;
  const ev = await findEventBySlug(slug);
  if (!ev) throw new HttpError(404, "Simulasi tidak ditemukan.");
  return ev;
}

async function execute(req: Request, ctx: RouteCtx, handler: Handler, needsAdmin: boolean) {
  try {
    const ev = await resolveEvent(ctx);
    if (needsAdmin && !(await isAdminForEvent(ev.id, ev.slug))) {
      throw new HttpError(401, "Silakan masuk ke panel simulasi ini.");
    }
    return await handler(ev, req, ctx);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    throw err;
  }
}

/** Route publik untuk satu simulasi (kiosk, login). */
export function publicRoute(handler: Handler) {
  return (req: Request, ctx: RouteCtx) => execute(req, ctx, handler, false);
}

/** Route panel panitia — sesi harus milik event di URL yang sama. */
export function adminRoute(handler: Handler) {
  return (req: Request, ctx: RouteCtx) => execute(req, ctx, handler, true);
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}
