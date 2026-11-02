import assert from "node:assert/strict";
import { test } from "node:test";
import { reportMarkdown, shouldArchive, type BuildEvent } from "./report_policy.ts";

const events: BuildEvent[] = [{
  service: "release-api",
  commit: "abc123",
  status: "passed",
  diagnostics: ["latency 120ms", "patient MRN 123"]
}];

test("archives a clean release and removes sensitive diagnostics", () => {
  assert.equal(shouldArchive(events), true);
  const markdown = reportMarkdown(events);
  assert.match(markdown, /latency 120ms/);
  assert.doesNotMatch(markdown, /patient|MRN/);
});

test("does not archive a failed build", () => {
  assert.equal(shouldArchive([{ ...events[0], status: "failed" }]), false);
});
