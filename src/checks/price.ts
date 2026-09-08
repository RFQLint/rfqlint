import type { CheckResult } from "../types.js";
import { isPlainObject } from "./info.js";

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

const REQUIRED_STRING_FIELDS = ["total_price", "price", "sell_amount", "buy_amount"] as const;

/**
 * Probes `GET /price` with the first two distinct assets discovered in
 * /info — public, no SEP-10 required. Needs at least 2 assets to form a
 * sell/buy pair; skipped (empty result) otherwise. Same well-formed-error
 * tolerance as the /prices check — this validates shape, not that this
 * synthetic amount is necessarily within the anchor's tradeable range.
 */
export async function checkPriceEndpoint(quoteServer: string, assetIds: string[]): Promise<CheckResult[]> {
  if (assetIds.length < 2) return [];
  const [sellAsset, buyAsset] = assetIds;
  const params = new URLSearchParams({
    sell_asset: sellAsset,
    buy_asset: buyAsset,
    sell_amount: "1",
    context: "sep6",
  });
  const url = `${quoteServer.replace(/\/$/, "")}/price?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return [fail("price-reachable", "GET /price is reachable", `Request to ${url} failed: ${(err as Error).message}`)];
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    return [
      fail(
        "price-json",
        "/price returns valid JSON",
        `HTTP ${res.status}, and the body failed to parse as JSON: ${(err as Error).message}`,
      ),
    ];
  }

  if (!res.ok) {
    if (isWellFormedErrorBody(body)) {
      return [pass("price-shape", "GET /price responds with a well-formed result for a derived query (success or spec-shaped error)")];
    }
    return [fail("price-shape", "GET /price responds with a well-formed result for a derived query", `HTTP ${res.status} with a non-spec-shaped body`)];
  }

  if (!isPlainObject(body)) {
    return [fail("price-shape", "GET /price responds with a well-formed result for a derived query", "200 response is not a JSON object")];
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof body[field] !== "string") {
      return [fail("price-shape", "GET /price responds with a well-formed result for a derived query", `\`${field}\` is missing or not a string`)];
    }
  }

  const fee = body.fee;
  if (!isPlainObject(fee) || typeof fee.total !== "string" || typeof fee.asset !== "string") {
    return [fail("price-shape", "GET /price responds with a well-formed result for a derived query", "`fee.total` and `fee.asset` must be present strings")];
  }

  return [pass("price-shape", "GET /price responds with a well-formed result for a derived query")];
}
