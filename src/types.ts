export interface StellarToml {
  VERSION?: string;
  NETWORK_PASSPHRASE?: string;
  ANCHOR_QUOTE_SERVER?: string;
  [key: string]: unknown;
}

export type CheckStatus = "pass" | "fail" | "warn";

export interface CheckResult {
  id: string;
  description: string;
  status: CheckStatus;
  message?: string;
  specRef: string;
}

export interface ConformanceReport {
  homeDomain: string;
  anchorQuoteServer?: string;
  results: CheckResult[];
}
