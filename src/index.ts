import { fetchStellarToml, StellarTomlError } from "./toml.js";
import { checkInfoEndpoint } from "./checks/info.js";
import { checkPricesEndpoint } from "./checks/prices.js";
import { checkPriceEndpoint } from "./checks/price.js";
import type { ConformanceReport, CheckResult } from "./types.js";

export * from "./types.js";
export { fetchStellarToml, parseStellarToml, StellarTomlError } from "./toml.js";
export { checkInfoEndpoint, isValidAssetId } from "./checks/info.js";
export { checkPricesEndpoint } from "./checks/prices.js";
export { checkPriceEndpoint } from "./checks/price.js";
export { formatText, formatJson } from "./report.js";

const SEP38 = "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md";
const SEP1 = "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md";

/**
 * Runs the full SEP-38 conformance suite against a home domain:
 * resolves stellar.toml (SEP-1), locates ANCHOR_QUOTE_SERVER, checks
 * GET /info, then derives real queries from discovered assets to check
 * GET /prices and (with >=2 assets) GET /price. All three endpoints are
 * public per spec — no SEP-10 session is built or required.
 */
export async function runConformanceSuite(homeDomain: string): Promise<ConformanceReport> {
  const results: CheckResult[] = [];

  let toml;
  try {
    toml = await fetchStellarToml(homeDomain);
    results.push({ id: "toml-fetch", description: "stellar.toml is reachable and valid TOML", status: "pass", specRef: SEP1 });
  } catch (err) {
    results.push({
      id: "toml-fetch",
      description: "stellar.toml is reachable and valid TOML",
      status: "fail",
      message: err instanceof StellarTomlError ? err.message : String(err),
      specRef: SEP1,
    });
    return { homeDomain, results };
  }

  const anchorQuoteServer = toml.ANCHOR_QUOTE_SERVER;
  if (!anchorQuoteServer || typeof anchorQuoteServer !== "string") {
    results.push({
      id: "toml-quote-server",
      description: "stellar.toml declares ANCHOR_QUOTE_SERVER",
      status: "fail",
      message: "ANCHOR_QUOTE_SERVER is missing from stellar.toml",
      specRef: SEP38,
    });
    return { homeDomain, results };
  }
  results.push({ id: "toml-quote-server", description: "stellar.toml declares ANCHOR_QUOTE_SERVER", status: "pass", specRef: SEP38 });

  const { results: infoResults, assetIds } = await checkInfoEndpoint(anchorQuoteServer);
  results.push(...infoResults);

  results.push(...(await checkPricesEndpoint(anchorQuoteServer, assetIds)));
  results.push(...(await checkPriceEndpoint(anchorQuoteServer, assetIds)));

  return { homeDomain, anchorQuoteServer, results };
}
