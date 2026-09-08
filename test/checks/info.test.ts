import { describe, it, expect, afterEach } from "vitest";
import { checkInfoEndpoint } from "../../src/checks/info.js";
import { startMockAnchor, NATIVE, USDC, USD, type MockAnchor } from "../fixtures/mock-anchor.js";

let anchor: MockAnchor | undefined;

afterEach(async () => {
  await anchor?.close();
  anchor = undefined;
});

describe("checkInfoEndpoint", () => {
  it("passes a spec-conformant /info response and returns discovered asset ids", async () => {
    anchor = await startMockAnchor({
      info: { assets: [{ asset: NATIVE }, { asset: USDC }, { asset: USD, country_codes: ["US"] }] },
    });

    const { results, assetIds } = await checkInfoEndpoint(`${anchor.url}/sep38`);
    expect(results.filter((r) => r.status === "fail")).toEqual([]);
    expect(assetIds).toEqual([NATIVE, USDC, USD]);
  });

  it("flags an invalid asset identifier", async () => {
    anchor = await startMockAnchor({ info: { assets: [{ asset: "not-a-valid-asset-id" }] } });
    const { results } = await checkInfoEndpoint(`${anchor.url}/sep38`);
    expect(results.some((r) => r.id === "info-asset-0-id" && r.status === "fail")).toBe(true);
  });

  it("accepts stellar:native, stellar:CODE:ISSUER, and iso4217:CODE forms", async () => {
    anchor = await startMockAnchor({ info: { assets: [{ asset: NATIVE }, { asset: USDC }, { asset: USD }] } });
    const { results } = await checkInfoEndpoint(`${anchor.url}/sep38`);
    expect(results.some((r) => r.id.startsWith("info-asset-") && r.status === "fail")).toBe(false);
  });

  it("flags a malformed delivery-methods array", async () => {
    anchor = await startMockAnchor({
      info: { assets: [{ asset: USD, sell_delivery_methods: ["not-an-object"] }] },
    });
    const { results } = await checkInfoEndpoint(`${anchor.url}/sep38`);
    expect(results.some((r) => r.id === `info-${USD}-sell_delivery_methods` && r.status === "fail")).toBe(true);
  });

  it("flags malformed country_codes", async () => {
    anchor = await startMockAnchor({ info: { assets: [{ asset: USD, country_codes: [1, 2] }] } });
    const { results } = await checkInfoEndpoint(`${anchor.url}/sep38`);
    expect(results.some((r) => r.id === `info-${USD}-country_codes` && r.status === "fail")).toBe(true);
  });

  it("warns when assets is empty", async () => {
    anchor = await startMockAnchor({ info: { assets: [] } });
    const { results, assetIds } = await checkInfoEndpoint(`${anchor.url}/sep38`);
    expect(results.some((r) => r.id === "info-shape" && r.status === "warn")).toBe(true);
    expect(assetIds).toEqual([]);
  });

  it("fails cleanly when the endpoint is unreachable", async () => {
    const { results } = await checkInfoEndpoint("http://127.0.0.1:1");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: "info-reachable", status: "fail" });
  });
});
