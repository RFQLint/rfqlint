import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface MockAnchorOptions {
  toml?: string;
  info?: unknown;
  infoStatus?: number;
  prices?: unknown;
  pricesStatus?: number;
  price?: unknown;
  priceStatus?: number;
}

export interface MockAnchor {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export async function startMockAnchor(opts: MockAnchorOptions): Promise<MockAnchor> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/.well-known/stellar.toml") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(opts.toml ?? "");
      return;
    }
    if (url.pathname === "/sep38/info") {
      res.writeHead(opts.infoStatus ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify(opts.info ?? {}));
      return;
    }
    if (url.pathname === "/sep38/prices") {
      res.writeHead(opts.pricesStatus ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify(opts.prices ?? {}));
      return;
    }
    if (url.pathname === "/sep38/price") {
      res.writeHead(opts.priceStatus ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify(opts.price ?? {}));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  return {
    server,
    url,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export function tomlFor(mockUrl: string): string {
  return `ANCHOR_QUOTE_SERVER="${mockUrl}/sep38"\n`;
}

export const NATIVE = "stellar:native";
export const USDC = "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const USD = "iso4217:USD";
