import type { ConformanceReport, CheckStatus } from "./types.js";

const ICON: Record<CheckStatus, string> = { pass: "✔", fail: "✘", warn: "⚠" };

export function formatText(report: ConformanceReport): string {
  const lines: string[] = [];
  lines.push(`SEP-38 conformance report for ${report.homeDomain}`);
  if (report.anchorQuoteServer) {
    lines.push(`Anchor quote server: ${report.anchorQuoteServer}`);
  }
  lines.push("");

  for (const r of report.results) {
    lines.push(`${ICON[r.status]} [${r.status.toUpperCase()}] ${r.description}`);
    if (r.message) lines.push(`    ${r.message}`);
  }

  const counts = report.results.reduce(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { pass: 0, fail: 0, warn: 0 } as Record<CheckStatus, number>,
  );
  lines.push("");
  lines.push(`${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings`);

  return lines.join("\n");
}

export function formatJson(report: ConformanceReport): string {
  return JSON.stringify(report, null, 2);
}
