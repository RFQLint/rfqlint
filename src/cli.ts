#!/usr/bin/env node
import { Command } from "commander";
import { runConformanceSuite } from "./index.js";
import { formatText, formatJson } from "./report.js";

const program = new Command();

program
  .name("sep38-conformance")
  .description("Checks a Stellar anchor's SEP-38 (Anchor RFQ / quote server) implementation for spec conformance")
  .version("0.1.0");

program
  .command("check <homeDomain>")
  .description("Run the conformance suite against an anchor's home domain (e.g. example.com)")
  .option("--json", "output the report as JSON")
  .action(async (homeDomain: string, opts: { json?: boolean }) => {
    const report = await runConformanceSuite(homeDomain);
    console.log(opts.json ? formatJson(report) : formatText(report));
    const hasFailures = report.results.some((r) => r.status === "fail");
    process.exitCode = hasFailures ? 1 : 0;
  });

program.parseAsync(process.argv);
