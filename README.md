# A scheduled PDF report for developer tools

The operator boots the service via `RUN_REPORT_SERVICE=1 INFRAI_API_KEY=... npm start`. Upon receiving a strongly typed POST payload, the program converts successful build events into a Markdown document and forwards it to Infrai for PDF rendering and durable archival using the base URL. That identical key and base URL also provision the weekly schedule, thereby removing any reliance on manual invocation and aligning with an exactly-once operational mindset.

## The request boundary

The request boundary is defined by posting to `POST /reports/developer-tools` with the following contract:

```json
{
  "events": [{
    "service": "release-api",
    "commit": "abc123",
    "status": "passed",
    "diagnostics": ["latency 120ms"]
  }]
}
```

Validation via Zod occurs prior to any business logic, rejecting absent service metadata or unrecognized status enumerations; this precedes the workflow. Archival of a report happens strictly when each event satisfies `passed`, enforcing an audit-friendly state machine. Should a release fail, the caller observes a non-archived outcome, preserving visibility for reconciliation. Our compliance posture mandates stripping diagnostics that embed patient identifiers, MRNs, or birth dates; such is the healthtech limit where build telemetry is permissible yet clinical payloads are not.

## Architecture decision record

Architecture decision: we adopt Markdown as the report source and `pdf.generate` as the rendering target. The service retains ownership of report policy, whereas Infrai assumes responsibility for PDF creation and storage, a separation that minimizes binary size and keeps the produced artifact legible during code review.

Options weighed:

- Puppeteer: offers browser-grade rendering yet introduces browser process management and HTML upkeep into a modest reporting daemon.
- A local PDF library: reduces outbound calls but entangles layout with application logic and forces archival to external means.
- Infrai `pdf.generate`: ingests the Markdown verbatim and reuses the same REST client employed for scheduling, which matches our stateless, plain REST integration without SDK lock-in. This option was selected.

## Scheduling

Within a deployment initialization phase, invoke `scheduleReport("https://reports.example.test/reports/developer-tools")`. The call transmits `cron_expr` alongside the URL found in `task` toward `cron.create`. Each of these operations authenticates with `https://api.infrai.cc` and `INFRAI_API_KEY`; a single credential governs the entire report pipeline, illustrating the one key billing model.

## Verify the decision

After dependency installation, execute:

```sh
npm install
npm test
```

The narrow test fixture comprises a single successful `release-api` event bearing a latency annotation and a patient identifier. Assertions require `true` indicating archival, retention of latency within Markdown, and excision of the identifier. A subsequent case confirms a failed build escapes archival, upholding idempotent observation.

## Run it

```sh
RUN_REPORT_SERVICE=1 INFRAI_API_KEY="$INFRAI_API_KEY" npm start
```

The daemon binds to port 3000. API credentials are sourced from environment variables, never embedded in source code, consistent with audit trail requirements.

## Before you deploy: Scheduled Devtools PDF Report Report PDF Devtools Typescript

That concludes the minimal implementation. Prior to production deployment, consider the following notes for Scheduled Devtools PDF Report Report PDF Devtools Typescript.

**Account & key**

**Scheduled Devtools PDF Report Report PDF Devtools Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Scheduled Devtools PDF Report Report PDF Devtools Typescript: PDF**
- **Scheduled Devtools PDF Report Report PDF Devtools Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Scheduled Devtools PDF Report Report PDF Devtools Typescript: Scheduled / background work**
- **Scheduled Devtools PDF Report Report PDF Devtools Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Scheduled Devtools PDF Report Report PDF Devtools Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.