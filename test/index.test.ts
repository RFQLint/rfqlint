import { describe, it, expect, afterEach } from "vitest";
import { runConformanceSuite } from "../src/index.js";
import { startMockAnchor, tomlFor, NATIVE, USD, type MockAnchor } from "./fixtures/mock-anchor.js";

let anchor: MockAnchor | undefined;

afterEach(async () => {
  await anchor?.close();
  anchor = undefined;
});

describe("runConformanceSuite", () => {
  it("fails cleanly when ANCHOR_QUOTE_SERVER is missing", async () => {
    anchor = await startMockAnchor({ toml: "VERSION=\"2.7.0\"\n" });
    const report = await runConformanceSuite(anchor.url);
    expect(report.results.some((r) => r.id === "toml-quote-server" && r.status === "fail")).toBe(true);
  });

  it("runs the full suite end to end for a fully conformant anchor with 2+ assets", async () => {
    const opts = {
      info: { assets: [{ asset: NATIVE }, { asset: USD }] },
      prices: { buy_assets: [{ asset: USD, price: "0.39", decimals: 4 }] },
      price: {
        total_price: "0.43",
        price: "0.39",
        sell_amount: "1",
        buy_amount: "2.31",
        fee: { total: "0.10", asset: NATIVE },
      },
    } as { toml?: string; info: unknown; prices: unknown; price: unknown };
    anchor = await startMockAnchor(opts);
    opts.toml = tomlFor(anchor.url);

    const report = await runConformanceSuite(anchor.url);
    expect(report.results.filter((r) => r.status === "fail")).toEqual([]);
    expect(report.results.some((r) => r.id === "price-shape")).toBe(true);
  });

  it("skips the /price check (no results for it) with only 1 discovered asset", async () => {
    const opts = {
      info: { assets: [{ asset: NATIVE }] },
      prices: { buy_assets: [] },
    } as { toml?: string; info: unknown; prices: unknown };
    anchor = await startMockAnchor(opts);
    opts.toml = tomlFor(anchor.url);

    const report = await runConformanceSuite(anchor.url);
    expect(report.results.some((r) => r.id === "price-shape")).toBe(false);
  });
});
