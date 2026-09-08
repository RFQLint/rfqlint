import { describe, it, expect, afterEach } from "vitest";
import { checkPriceEndpoint } from "../../src/checks/price.js";
import { startMockAnchor, NATIVE, USD, type MockAnchor } from "../fixtures/mock-anchor.js";

let anchor: MockAnchor | undefined;

afterEach(async () => {
  await anchor?.close();
  anchor = undefined;
});

const VALID_PRICE = {
  total_price: "0.43",
  price: "0.39",
  sell_amount: "1",
  buy_amount: "2.31",
  fee: { total: "0.10", asset: NATIVE },
};

describe("checkPriceEndpoint", () => {
  it("is skipped (no results) with fewer than 2 discovered assets", async () => {
    const results = await checkPriceEndpoint("http://127.0.0.1:1", [NATIVE]);
    expect(results).toEqual([]);
  });

  it("passes a spec-conformant response", async () => {
    anchor = await startMockAnchor({ price: VALID_PRICE });
    const results = await checkPriceEndpoint(`${anchor.url}/sep38`, [NATIVE, USD]);
    expect(results).toEqual([expect.objectContaining({ id: "price-shape", status: "pass" })]);
  });

  it("flags a missing required field", async () => {
    const { total_price: _drop, ...missingTotalPrice } = VALID_PRICE;
    anchor = await startMockAnchor({ price: missingTotalPrice });
    const results = await checkPriceEndpoint(`${anchor.url}/sep38`, [NATIVE, USD]);
    expect(results).toEqual([expect.objectContaining({ id: "price-shape", status: "fail" })]);
  });

  it("flags a malformed fee object", async () => {
    anchor = await startMockAnchor({ price: { ...VALID_PRICE, fee: { total: "0.10" } } }); // fee.asset missing
    const results = await checkPriceEndpoint(`${anchor.url}/sep38`, [NATIVE, USD]);
    expect(results).toEqual([expect.objectContaining({ id: "price-shape", status: "fail" })]);
  });

  it("treats a well-formed spec error response as a pass", async () => {
    anchor = await startMockAnchor({ price: { error: "amount below minimum" }, priceStatus: 400 });
    const results = await checkPriceEndpoint(`${anchor.url}/sep38`, [NATIVE, USD]);
    expect(results).toEqual([expect.objectContaining({ id: "price-shape", status: "pass" })]);
  });

  it("gives a clear message (including HTTP status) when the body isn't JSON at all", async () => {
    // simulate a raw HTML error page by writing outside the mock's json helper
    const { createServer } = await import("node:http");
    const server = createServer((req, res) => {
      if (req.url?.startsWith("/sep38/price")) {
        res.writeHead(502, { "content-type": "text/html" });
        res.end("<!DOCTYPE html><html>bad gateway</html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const results = await checkPriceEndpoint(`http://127.0.0.1:${port}/sep38`, [NATIVE, USD]);
    expect(results[0]).toMatchObject({ id: "price-json", status: "fail" });
    expect(results[0].message).toContain("HTTP 502");

    await new Promise((resolve) => server.close(resolve));
  });
});
