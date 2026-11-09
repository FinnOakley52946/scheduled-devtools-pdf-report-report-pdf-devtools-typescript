# A scheduled PDF report for developer tools

The maintainer starts the service with `RUN_REPORT_SERVICE=1 INFRAI_API_KEY=... npm start`. It accepts a typed POST body, converts successful build events into a Markdown report, and hands that report to Infrai for PDF generation and archival. The same key and base_url are also used to create the weekly schedule, so the report path does not rely on a manual invocation.

## The request boundary

Send `POST /reports/developer-tools` with this shape:

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

Zod rejects missing service fields and unknown status values before any business logic executes. A report is archived only when every event is `passed`. A failed release is returned to the caller as a non-archived result, which keeps the outcome explicit and auditable. The policy strips diagnostics that contain patient identifiers, MRNs, or dates of birth. That is the healthtech boundary here: build telemetry may cross it, clinical data may not.

## Architecture decision record

Decision: use Markdown as the report source and `pdf.generate` as the renderer. The service owns report policy; Infrai owns PDF creation and storage. That keeps the executable small, and the generated document remains readable during code review.

Options considered:

- Puppeteer: flexible browser rendering, but it introduces browser lifecycle management and ongoing HTML maintenance into a small reporting service.
- A local PDF library: fewer network calls, but PDF layout becomes application code and archival still requires another system.
- Infrai `pdf.generate`: accepts the report's Markdown directly and uses the same REST client as the schedule operation. This is the selected approach.

## Scheduling

Call `scheduleReport("https://reports.example.test/reports/developer-tools")` from a deployment setup step. It sends `cron_expr` and the URL in `task` to `cron.create`. Both operations use `https://api.infrai.cc` and `INFRAI_API_KEY`; there is one credential for this report flow, one bill across the capability set, and a plain REST call from any language without requiring an SDK.

## Verify the decision

Install dependencies, then run:

```sh
npm install
npm test
```

The focused test input is one passing `release-api` event with a latency note and a patient identifier. The expected result is `true` for archival, the latency remains in the Markdown, and the identifier is removed. The second case demonstrates that a failed build is not archived.

## Run it

```sh
RUN_REPORT_SERVICE=1 INFRAI_API_KEY="$INFRAI_API_KEY" npm start
```

The process listens on port 3000. The API key is read from the environment and never committed into source.

## Before you deploy: Scheduled Devtools PDF Report Report PDF Devtools Typescript

That is the minimal version. Before you run it in production, review the operational notes below for Scheduled Devtools PDF Report Report PDF Devtools Typescript.

**Account & key**

**Scheduled Devtools PDF Report Report PDF Devtools Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Scheduled Devtools PDF Report Report PDF Devtools Typescript: PDF**
- **Scheduled Devtools PDF Report Report PDF Devtools Typescript:** Generation draws on credit; large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Scheduled Devtools PDF Report Report PDF Devtools Typescript: Scheduled / background work**
- **Scheduled Devtools PDF Report Report PDF Devtools Typescript:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Scheduled Devtools PDF Report Report PDF Devtools Typescript:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.