import { adminDb } from "@/lib/instant-admin";
import crypto from "crypto";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await adminDb.query({
    webhookEndpoints: { $: { where: { id, userId } } },
  });

  const endpoint = data?.webhookEndpoints?.[0] as
    | { id: string; url: string; secret: string }
    | undefined;

  if (!endpoint) return Response.json({ error: "Not found" }, { status: 404 });

  const payload = {
    event: "test",
    timestamp: new Date().toISOString(),
    message: "This is a test delivery from Keen.",
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature =
    "sha256=" + crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Keen-Signature": signature,
        "X-Keen-Event": "test",
        "X-Keen-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    return Response.json({ status: response.status, ok: response.ok });
  } catch (err) {
    return Response.json({
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : "Request failed",
    });
  }
}
