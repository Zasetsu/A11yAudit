import { lookup } from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSafeUrl, crawlStaticSeed, isBlockedHostnameOrIp } from "./index";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn()
}));

describe("network safety", () => {
  beforeEach(() => {
    vi.mocked(lookup).mockReset();
  });

  it("blocks localhost and private IPs", () => {
    expect(isBlockedHostnameOrIp("localhost")).toBe(true);
    expect(isBlockedHostnameOrIp("127.0.0.1")).toBe(true);
    expect(isBlockedHostnameOrIp("0.0.0.0")).toBe(true);
    expect(isBlockedHostnameOrIp("10.0.0.1")).toBe(true);
    expect(isBlockedHostnameOrIp("192.168.1.10")).toBe(true);
    expect(isBlockedHostnameOrIp("169.254.169.254")).toBe(true);
  });

  it("allows public hostnames", () => {
    expect(isBlockedHostnameOrIp("example.gov")).toBe(false);
  });

  it("rejects bracketed unsafe IPv6 URLs", () => {
    expect(() => assertSafeUrl("http://[::]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[::1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[fe80::1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[fe90::1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[febf::1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[fc00::1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[fd00::1]/")).toThrow("Blocked unsafe audit target");
  });

  it("rejects unspecified IPv4 URLs", () => {
    expect(() => assertSafeUrl("http://0.0.0.0/")).toThrow("Blocked unsafe audit target");
  });

  it("allows public IPv6 URLs", () => {
    expect(() => assertSafeUrl("http://[2001:4860:4860::8888]/")).not.toThrow();
  });

  it("rejects unsafe IPv4-mapped IPv6 URLs", () => {
    expect(() => assertSafeUrl("http://[::ffff:127.0.0.1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[::ffff:10.0.0.1]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[::ffff:192.168.1.10]/")).toThrow("Blocked unsafe audit target");
    expect(() => assertSafeUrl("http://[::ffff:169.254.169.254]/")).toThrow("Blocked unsafe audit target");
  });

  it("allows public IPv4-mapped IPv6 URLs", () => {
    expect(() => assertSafeUrl("http://[::ffff:8.8.8.8]/")).not.toThrow();
  });

  it("prevents crawling unsafe IPv6 URLs", async () => {
    await expect(crawlStaticSeed({ startUrl: "http://[::1]/" })).rejects.toThrow("Blocked unsafe audit target");
  });

  it.each([
    ["127.0.0.1", 4],
    ["10.0.0.1", 4],
    ["169.254.169.254", 4],
    ["::1", 6]
  ] as const)("rejects public hostnames that resolve to %s", async (address, family) => {
    vi.mocked(lookup).mockResolvedValue([{ address, family }]);

    await expect(crawlStaticSeed({ startUrl: "https://public.example/" })).rejects.toThrow(
      "Blocked unsafe audit target"
    );
  });
});
