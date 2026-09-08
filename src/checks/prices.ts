import type { CheckResult } from "../types.js";
import { isPlainObject, isValidAssetId } from "./info.js";

const SEP38 = "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md";

function fail(id: string, description: string, message: string): CheckResult {
  return { id, description, status: "fail", message, specRef: SEP38 };
}
function pass(id: string, description: string): CheckResult {
  return { id, description, status: "pass", specRef: SEP38 };
}

function isWellFormedErrorBody(body: unknown): boolean {
  return isPlainObject(body) && typeof body.error === "string";
}

/**
 * Probes `GET /prices?sell_asset=<assetIds[0]>` — public, no SEP-10 required.
 * A well-formed spec error response ({error: string}) counts as a pass:
 * this check validates response *shape*, not that this specific synthetic
 * query is guaranteed to be answerable by the anchor.
 */
export async function checkPricesEndpoint(quoteServer: string, assetIds: string[]): Promise<CheckResult[]> {
  if (assetIds.length === 0) return [];
  const [sellAsset] = assetIds;
  const url = `${quoteServer.replace(/\/$/, "")}/prices?sell_asset=${encodeURIComponent(sellAsset)}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return [fail("prices-reachable", "GET /prices is reachable", `Request to ${url} failed: ${(err as Error).message}`)];
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    return [
      fail(
        "prices-json",
        "/prices returns valid JSON",
        `HTTP ${res.status}, and the body failed to parse as JSON: ${(err as Error).message}`,
      ),
    ];
  }

  if (!res.ok) {
    if (isWellFormedErrorBody(body)) {
      return [pass("prices-shape", "GET /prices responds with a well-formed result for a derived query (success or spec-shaped error)")];
    }
    return [fail("prices-shape", "GET /prices responds with a well-formed result for a derived query", `HTTP ${res.status} with a non-spec-shaped body`)];
  }

  if (!isPlainObject(body) || !Array.isArray(body.buy_assets)) {
    return [fail("prices-shape", "GET /prices responds with a well-formed result for a derived query", "200 response missing `buy_assets` array")];
  }

  const malformed = body.buy_assets.some(
    (a) => !isPlainObject(a) || !isValidAssetId(a.asset) || typeof a.price !== "string" || typeof a.decimals !== "number",
  );
  if (malformed) {
    return [fail("prices-shape", "GET /prices responds with a well-formed result for a derived query", "an entry in `buy_assets` is missing/malformed asset, price, or decimals")];
  }

  return [pass("prices-shape", "GET /prices responds with a well-formed result for a derived query")];
}
