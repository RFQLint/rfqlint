import { describe, it, expect, afterEach } from "vitest";
import { fetchStellarToml, parseStellarToml, StellarTomlError } from "../src/toml.js";
import { startMockAnchor, type MockAnchor } from "./fixtures/mock-anchor.js";

let anchor: MockAnchor | undefined;

afterEach(async () => {
  await anchor?.close();
  anchor = undefined;
});

describe("fetchStellarToml", () => {
  it("fetches and parses a valid stellar.toml over the network", async () => {
    anchor = await startMockAnchor({ toml: `ANCHOR_QUOTE_SERVER="https://example.com/sep38"\n` });
    const toml = await fetchStellarToml(anchor.url);
    expect(toml.ANCHOR_QUOTE_SERVER).toBe("https://example.com/sep38");
  });

  it("throws StellarTomlError when the host is unreachable", async () => {
    await expect(fetchStellarToml("http://127.0.0.1:1")).rejects.toBeInstanceOf(StellarTomlError);
  });

  it("throws StellarTomlError on a non-2xx response", async () => {
    anchor = await startMockAnchor({});
    await expect(fetchStellarToml(`${anchor.url}/does-not-exist`)).rejects.toBeInstanceOf(StellarTomlError);
  });
});

describe("parseStellarToml", () => {
  it("throws StellarTomlError on malformed TOML", () => {
    expect(() => parseStellarToml("this is not : valid [[ toml")).toThrow(StellarTomlError);
  });
});
