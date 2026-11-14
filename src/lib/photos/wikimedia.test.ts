import { describe, expect, it } from "vitest";
import { cleanTitle, cleanWidth, photoBytes } from "./wikimedia";

describe("photo proxy inputs", () => {
  it("accepts Wikipedia titles in any script and rejects everything else", () => {
    expect(cleanTitle("Kyoto")).toBe("Kyoto");
    expect(cleanTitle("  Fushimi   Inari-taisha ")).toBe("Fushimi Inari-taisha");
    expect(cleanTitle("Montréal")).toBe("Montréal");
    expect(cleanTitle("Portland, Oregon")).toBe("Portland, Oregon");
    expect(cleanTitle("")).toBeNull();
    expect(cleanTitle("a/b")).toBeNull();
    expect(cleanTitle("https://evil.example")).toBeNull();
    expect(cleanTitle("x".repeat(121))).toBeNull();
    expect(cleanTitle(42)).toBeNull();
  });
  it("rounds widths up to a ready-made thumbnail size", () => {
    expect(cleanWidth("300")).toBe(500);
    expect(cleanWidth("960")).toBe(960);
    expect(cleanWidth("1000")).toBe(1280);
    expect(cleanWidth("99999")).toBe(1280);
    expect(cleanWidth(null)).toBe(500);
  });
  it("never fetches anything but Wikimedia's image host", async () => {
    expect(await photoBytes("https://example.com/a.jpg")).toBeNull();
    expect(await photoBytes("http://upload.wikimedia.org/a.jpg")).toBeNull();
    expect(await photoBytes("not a url")).toBeNull();
    expect(await photoBytes("https://thumb.wikimedia.org.evil.example/a.jpg")).toBeNull();
  });
});

import { curatedPhoto } from "./curated";
describe("the website's own photos", () => {
  it("are used for known places and airports", () => {
    expect(curatedPhoto("Maldives", null, 960)).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?w=960/);
    expect(curatedPhoto("Lisbon", "LIS", 500)).toMatch(/w=500/);
    expect(curatedPhoto("Osaka", "KIX", 500)).toMatch(/unsplash/);
    expect(curatedPhoto("Dolomites", "VCE", 960)).toBeNull();
    expect(curatedPhoto("Zermatt", null, 960)).toBeNull();
    expect(curatedPhoto("Somewhere", "XYZ", 960)).toBeNull();
  });
});
