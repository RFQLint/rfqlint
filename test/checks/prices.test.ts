import { describe, it, expect, afterEach } from "vitest";
import { checkPricesEndpoint } from "../../src/checks/prices.js";
import { startMockAnchor, NATIVE, USD, type MockAnchor } from "../fixtures/mock-anchor.js";

let anchor: MockAnchor | undefined;

afterEach(async () => {
  await anchor?.close();
  anchor = undefined;
});

describe("checkPricesEndpoint", () => {
  it("is skipped (no results) when there are no discovered assets", async () => {
    const results = await checkPricesEndpoint("http://127.0.0.1:1", []);
    expect(results).toEqual([]);
  });

  it("passes a spec-conformant response", async () => {
    anchor = await startMockAnchor({ prices: { buy_assets: [{ asset: USD, price: "0.39", decimals: 4 }] } });
    const results = await checkPricesEndpoint(`${anchor.url}/sep38`, [NATIVE]);
    expect(results).toEqual([expect.objectContaining({ id: "prices-shape", status: "pass" })]);
  });

  it("flags a malformed buy_assets entry", async () => {
    anchor = await startMockAnchor({ prices: { buy_assets: [{ asset: USD, price: 0.39, decimals: 4 }] } }); // price is a number, not a string
    const results = await checkPricesEndpoint(`${anchor.url}/sep38`, [NATIVE]);
    expect(results).toEqual([expect.objectContaining({ id: "prices-shape", status: "fail" })]);
  });

  it("treats a well-formed spec error response as a pass", async () => {
    anchor = await startMockAnchor({ prices: { error: "sell_asset not supported" }, pricesStatus: 400 });
    const results = await checkPricesEndpoint(`${anchor.url}/sep38`, [NATIVE]);
    expect(results).toEqual([expect.objectContaining({ id: "prices-shape", status: "pass" })]);
  });

  it("fails on a non-spec-shaped error response", async () => {
    anchor = await startMockAnchor({ prices: { whoops: true }, pricesStatus: 500 });
    const results = await checkPricesEndpoint(`${anchor.url}/sep38`, [NATIVE]);
    expect(results).toEqual([expect.objectContaining({ id: "prices-shape", status: "fail" })]);
  });
});
