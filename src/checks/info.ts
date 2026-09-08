import type { CheckResult } from "../types.js";

const SEP38 = "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md";

function fail(id: string, description: string, message: string, specRef = SEP38): CheckResult {
  return { id, description, status: "fail", message, specRef };
}
function pass(id: string, description: string, specRef = SEP38): CheckResult {
  return { id, description, status: "pass", specRef };
}
function warn(id: string, description: string, message: string, specRef = SEP38): CheckResult {
  return { id, description, status: "warn", message, specRef };
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// stellar:native | stellar:<CODE>:<ISSUER> | iso4217:<3-letter code>
const ASSET_RE = /^(stellar:native|stellar:[A-Z0-9]{1,12}:G[A-Z2-7]{55}|iso4217:[A-Z]{3})$/;

export function isValidAssetId(asset: unknown): asset is string {
  return typeof asset === "string" && ASSET_RE.test(asset);
}

function checkDeliveryMethods(entry: Record<string, unknown>, code: string, field: string, results: CheckResult[]): boolean {
  if (!(field in entry)) return true;
  const methods = entry[field];
  if (!Array.isArray(methods) || methods.some((m) => !isPlainObject(m) || typeof m.name !== "string")) {
    results.push(
      fail(
        `info-${code}-${field}`,
        `${field} is an array of {name, description?} objects if present`,
        `Asset "${code}"'s \`${field}\` is malformed`,
      ),
    );
    return false;
  }
  return true;
}

export interface InfoCheckOutcome {
  results: CheckResult[];
  /** Asset identifiers discovered in /info, in listed order, for the /prices and /price checks. */
  assetIds: string[];
}

/** Fetches `${quoteServer}/info` and checks the response against SEP-38 §GET /info. Public — no SEP-10 required. */
export async function checkInfoEndpoint(quoteServer: string): Promise<InfoCheckOutcome> {
  const results: CheckResult[] = [];
  const url = `${quoteServer.replace(/\/$/, "")}/info`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    results.push(fail("info-reachable", "GET /info is reachable", `Request to ${url} failed: ${(err as Error).message}`));
    return { results, assetIds: [] };
  }
  if (!res.ok) {
    results.push(fail("info-reachable", "GET /info is reachable", `${url} responded with HTTP ${res.status}`));
    return { results, assetIds: [] };
  }
  results.push(pass("info-reachable", "GET /info is reachable"));

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    results.push(fail("info-json", "/info returns valid JSON", `Failed to parse JSON: ${(err as Error).message}`));
    return { results, assetIds: [] };
  }
  results.push(pass("info-json", "/info returns valid JSON"));

  if (!isPlainObject(body) || !Array.isArray(body.assets)) {
    results.push(fail("info-shape", "assets is present and is an array", "Top-level `assets` field is missing or not an array"));
    return { results, assetIds: [] };
  }

  if (body.assets.length === 0) {
    results.push(warn("info-shape", "assets lists at least one entry", "`assets` array is empty"));
    return { results, assetIds: [] };
  }

  const assetIds: string[] = [];
  let allValid = true;
  for (const [i, entry] of body.assets.entries()) {
    if (!isPlainObject(entry)) {
      results.push(fail(`info-asset-${i}-shape`, `assets[${i}] is an object`, `Entry at index ${i} is not an object`));
      allValid = false;
      continue;
    }
    if (!isValidAssetId(entry.asset)) {
      results.push(
        fail(
          `info-asset-${i}-id`,
          `assets[${i}].asset is a valid asset identifier`,
          `"${String(entry.asset)}" doesn't match stellar:native, stellar:<CODE>:<ISSUER>, or iso4217:<CODE>`,
        ),
      );
      allValid = false;
      continue;
    }
    assetIds.push(entry.asset);

    const code = entry.asset;
    const okSell = checkDeliveryMethods(entry, code, "sell_delivery_methods", results);
    const okBuy = checkDeliveryMethods(entry, code, "buy_delivery_methods", results);
    if ("country_codes" in entry) {
      const cc = entry.country_codes;
      if (!Array.isArray(cc) || !cc.every((c) => typeof c === "string")) {
        results.push(fail(`info-${code}-country_codes`, "country_codes is an array of strings if present", `Asset "${code}"'s \`country_codes\` is malformed`));
        allValid = false;
      }
    }
    if (!okSell || !okBuy) allValid = false;
  }

  if (allValid) {
    results.push(pass("info-shape", "assets is present and every entry has a valid shape"));
  }

  return { results, assetIds };
}
