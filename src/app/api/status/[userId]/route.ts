import { adminDb } from "@/lib/instant-admin";

export const dynamic = "force-dynamic";

function resolveLastValue(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return (raw as { value: string }).value;
  }
  return undefined;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const data = await adminDb.query({
    monitors: { $: { where: { userId } } },
  });

  const monitors = (data?.monitors || []).map((m: Record<string, unknown>) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    url: m.url,
    value: resolveLastValue(m.lastValue) || null,
    status: m.lastStatus || null,
    lastChecked: m.lastChecked
      ? new Date(m.lastChecked as number).toISOString()
      : null,
    active: m.active,
  }));

  return Response.json({
    monitors,
    updatedAt: new Date().toISOString(),
  });
}
