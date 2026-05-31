import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isBlockedIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function mappedIpv4FromIpv6(host: string): string | undefined {
  if (!host.startsWith("::ffff:")) return undefined;

  const mapped = host.slice("::ffff:".length);
  if (isIP(mapped) === 4) return mapped;

  const hextets = mapped.split(":");
  if (hextets.length !== 2) return undefined;

  const [high, low] = hextets.map((part) => Number.parseInt(part, 16));
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return undefined;
  }

  return [
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff
  ].join(".");
}

function isIpv6LinkLocal(host: string): boolean {
  const firstHextet = Number.parseInt(host.split(":")[0] ?? "", 16);
  return Number.isInteger(firstHextet) && (firstHextet & 0xffc0) === 0xfe80;
}

function isIpv6Multicast(host: string): boolean {
  const firstHextet = Number.parseInt(host.split(":")[0] ?? "", 16);
  return Number.isInteger(firstHextet) && (firstHextet & 0xff00) === 0xff00;
}

function isIpv6UniqueLocal(host: string): boolean {
  const firstHextet = Number.parseInt(host.split(":")[0] ?? "", 16);
  return Number.isInteger(firstHextet) && (firstHextet & 0xfe00) === 0xfc00;
}

function normalizeHostname(hostname: string): string {
  const lowerHost = hostname.toLowerCase();
  return lowerHost.startsWith("[") && lowerHost.endsWith("]")
    ? lowerHost.slice(1, -1)
    : lowerHost;
}

export function isBlockedHostnameOrIp(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  if (isIP(host) === 4) {
    if (isBlockedIpv4(host)) return true;
  }

  if (isIP(host) === 6) {
    const mappedIpv4 = mappedIpv4FromIpv6(host);
    if (mappedIpv4) return isBlockedIpv4(mappedIpv4);
    if (host === "::") return true;
    if (host === "::1") return true;
    if (isIpv6LinkLocal(host)) return true;
    if (isIpv6UniqueLocal(host)) return true;
    if (isIpv6Multicast(host)) return true;
    if (host.startsWith("2001:db8:") || host === "2001:db8::") return true;
  }

  return false;
}

export function assertSafeUrl(input: string): void {
  const url = new URL(input);
  if (isBlockedHostnameOrIp(url.hostname)) {
    throw new Error(`Blocked unsafe audit target: ${url.hostname}`);
  }
}

export async function assertSafeResolvedUrl(input: string): Promise<void> {
  const url = new URL(input);
  assertSafeUrl(url.href);

  if (isIP(normalizeHostname(url.hostname)) !== 0) {
    return;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error(`Unable to resolve audit target: ${url.hostname}`);
  }

  for (const address of addresses) {
    if (isBlockedHostnameOrIp(address.address)) {
      throw new Error(`Blocked unsafe audit target: ${url.hostname} resolved to ${address.address}`);
    }
  }
}
