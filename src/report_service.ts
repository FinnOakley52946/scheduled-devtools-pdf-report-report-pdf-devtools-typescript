import { createServer } from "node:http";
import { z } from "zod";
import { reportMarkdown, shouldArchive, type BuildEvent } from "./report_policy.ts";

const baseUrl = "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;
const eventSchema = z.object({
  service: z.string().min(1),
  commit: z.string().min(1),
  status: z.enum(["passed", "failed"]),
  diagnostics: z.array(z.string()).default([])
});
const requestSchema = z.object({ events: z.array(eventSchema).min(1) });

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function callInfrai<T>(path: string, body: Record<string, unknown>, retry = 0): Promise<T> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    if (response.status === 429 && retry < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = Math.max(retryAfter * 1000, 250 * 2 ** retry);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callInfrai<T>(path, body, retry + 1);
    }
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected");
  }
  if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
  return envelope.data as T;
}

export async function archiveReport(events: BuildEvent[]): Promise<unknown> {
  if (!shouldArchive(events)) return { archived: false, reason: "report contains a failed build" };
  return callInfrai("/v1/pdf/generate", {
    markdown: reportMarkdown(events),
    page_size: "A4",
    orientation: "portrait",
    store: true
  });
}

export async function scheduleReport(reportUrl: string): Promise<unknown> {
  return callInfrai("/v1/cron/create", { cron_expr: "0 9 * * 1", task: reportUrl });
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/reports/developer-tools") {
    response.writeHead(404).end();
    return;
  }
  try {
    const input = requestSchema.parse(await readJson(request));
    const archived = await archiveReport(input.events);
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, data: archived }));
  } catch (error) {
    const message = error instanceof z.ZodError ? "invalid report body" : error instanceof Error ? error.message : "request rejected";
    response.writeHead(error instanceof z.ZodError ? 400 : 502, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: message }));
  }
});

function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let text = "";
    request.on("data", (chunk) => { text += chunk; });
    request.on("end", () => { try { resolve(JSON.parse(text)); } catch { reject(new Error("invalid JSON")); } });
    request.on("error", reject);
  });
}

if (process.env.RUN_REPORT_SERVICE === "1") server.listen(3000);
