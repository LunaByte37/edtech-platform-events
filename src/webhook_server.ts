import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";
import { decideDeadline, type LearnerDeadline } from "./deadline_decision.ts";

const eventBody = z.object({ type: z.string(), learnerId: z.string(), courseId: z.string(), dueAt: z.string(), completedAt: z.string().optional() });
const key = process.env.INFRAI_API_KEY;
const secret = process.env.INFRAI_WEBHOOK_SECRET;
if (!key || !secret) throw new Error("INFRAI_API_KEY and INFRAI_WEBHOOK_SECRET are required");
const webhookUrl = process.env.INFRAI_WEBHOOK_URL;
const infrai = new InfraiClient(key);

function validSignature(raw: string, signature: string): boolean {
  const expected = createHmac("sha256", secret as string).update(raw).digest("hex");
  const left = Buffer.from(expected); const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/platform-events") { response.writeHead(404).end(); return; }
  const chunks: Buffer[] = [];
  request.on("data", chunk => chunks.push(chunk));
  request.on("end", async () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!validSignature(raw, request.headers["x-infrai-signature"] as string ?? "")) { response.writeHead(401).end(); return; }
    const parsed = eventBody.safeParse(JSON.parse(raw));
    if (!parsed.success) { response.writeHead(400).end(); return; }
    const decision = decideDeadline(parsed.data as LearnerDeadline, new Date());
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ decision }));
  });
});

async function configureDelivery(): Promise<void> {
  if (!webhookUrl) throw new Error("INFRAI_WEBHOOK_URL is required when CONFIGURE_INFRAI=1");
  const registration = await infrai.request<{ webhook_id: string }>("/v1/account/webhooks/register", "POST", { url: `${webhookUrl.replace(/\/$/, "")}/platform-events`, events: ["account.updated"] });
  if (!registration.webhook_id) throw new Error("webhook_id was not returned");
  await infrai.request(`/v1/account/webhooks/deliveries/${registration.webhook_id}`, "GET");
  await infrai.request("/v1/queue/create", "POST", { name: "course-events-dlq" });
  await infrai.request("/v1/queue/create", "POST", { name: "course-events", dead_letter_queue: "course-events-dlq", max_retries: 3 });
}

if (process.env.CONFIGURE_INFRAI === "1") configureDelivery().catch(error => { console.error(error); process.exitCode = 1; });
server.listen(8787, () => console.log("course event receiver listening on http://localhost:8787"));
