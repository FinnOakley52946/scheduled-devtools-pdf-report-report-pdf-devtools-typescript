export type BuildEvent = {
  service: string;
  commit: string;
  status: "passed" | "failed";
  diagnostics: string[];
};

export function reportMarkdown(events: BuildEvent[]): string {
  const visible = events.map((event) => ({
    service: event.service,
    commit: event.commit,
    status: event.status,
    diagnostics: event.diagnostics.filter((item) => !/patient|mrn|dob/i.test(item))
  }));
  const rows = visible.map((event) =>
    `| ${event.service} | ${event.commit} | ${event.status} | ${event.diagnostics.join("; ") || "none"} |`
  );
  return [
    "# Developer tools report",
    "",
    "| Service | Commit | Status | Diagnostics |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "Generated from build and release observations. Sensitive health data is excluded."
  ].join("\n");
}

export function shouldArchive(events: BuildEvent[]): boolean {
  return events.length > 0 && events.every((event) => event.status === "passed");
}
