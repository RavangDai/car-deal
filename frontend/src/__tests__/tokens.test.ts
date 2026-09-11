import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastRatio, parseTokens } from "./contrast";

const css = readFileSync(resolve(__dirname, "../theme.css"), "utf8");
const t = parseTokens(css);

const WHITE = "#ffffff";

describe("palette values", () => {
  it("uses the Hyper UI surfaces", () => {
    expect(t["--paper"]).toBe("#ffffff");
    expect(t["--ground"]).toBe("#f9fafb");
    expect(t["--paper-soft"]).toBe("#f9fafb");
    expect(t["--paper-deep"]).toBe("#f3f4f6");
  });

  it("uses the Tailwind gray ramp for ink", () => {
    expect(t["--ink"]).toBe("#111827");
    expect(t["--ink-soft"]).toBe("#374151");
    expect(t["--ink-muted"]).toBe("#4b5563");
    expect(t["--ink-fade"]).toBe("#6b7280");
  });

  it("gives --blue a real value at last", () => {
    expect(t["--blue"]).toBe("#2563eb");
    expect(t["--indigo"]).toBe("#4f46e5");
    expect(t["--link"]).toBe("#2563eb");
    expect(t["--link-hover"]).toBe("#1d4ed8");
  });

  it("maps structure to the gray border ramp", () => {
    expect(t["--rule-faint"]).toBe("#f3f4f6");
    expect(t["--rule"]).toBe("#e5e7eb");
    expect(t["--rule-strong"]).toBe("#d1d5db");
  });

  it("collapses radius to the Tailwind scale", () => {
    expect(t["--r-sm"]).toBe("2px");
    expect(t["--r-md"]).toBe("4px");
    expect(t["--r-lg"]).toBe("8px");
    expect(t["--r-xl"]).toBe("12px");
    expect(t["--r-card"]).toBe("8px");
    expect(t["--r-pill"]).toBe("999px");
  });
});

describe("contrast floors", () => {
  it("every ink step clears AA on white", () => {
    for (const k of ["--ink", "--ink-soft", "--ink-muted", "--ink-fade"]) {
      expect(contrastRatio(t[k], WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ink-fade also clears AA on the page ground", () => {
    expect(contrastRatio(t["--ink-fade"], t["--ground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("each status deep tone clears AA on its own tint", () => {
    expect(contrastRatio(t["--green-deep"], t["--green-tint"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--amber-deep"], t["--amber-tint"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--red-deep"], t["--red-tint"])).toBeGreaterThanOrEqual(4.5);
  });

  it("each status deep tone clears AA on white", () => {
    for (const k of ["--green-deep", "--amber-deep", "--red-deep"]) {
      expect(contrastRatio(t[k], WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accents clear AA on white", () => {
    expect(contrastRatio(t["--blue"], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--indigo"], WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("the blue icon well clears the 3:1 graphic floor", () => {
    expect(contrastRatio(t["--blue"], t["--blue-tint"])).toBeGreaterThanOrEqual(3);
  });
});

describe("the dataviz palette is frozen", () => {
  it("keeps the nine validated marks", () => {
    expect(t["--series-1"]).toBe("#2a78d6");
    expect(t["--series-2"]).toBe("#eb6834");
    expect(t["--series-3"]).toBe("#4a3aa7");
    expect(t["--series-4"]).toBe("#e87ba4");
    expect(t["--ramp-1"]).toBe("#6da7ec");
    expect(t["--ramp-5"]).toBe("#0d366b");
  });

  it("every ramp step clears the 2:1 light-end floor on white", () => {
    for (const k of ["--ramp-1", "--ramp-2", "--ramp-3", "--ramp-4", "--ramp-5"]) {
      expect(contrastRatio(t[k], WHITE)).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps series-4 flagged as label-obligated (under 3:1)", () => {
    expect(contrastRatio(t["--series-4"], WHITE)).toBeLessThan(3);
  });
});

describe("tokens with live consumers survive", () => {
  it("keeps --img-ring, which five call sites still read", () => {
    expect(t["--img-ring"]).toBeDefined();
  });

  it("keeps --img-radius", () => {
    expect(t["--img-radius"]).toBe("8px");
  });
});

describe("dead tokens are gone", () => {
  it("drops the instrument-era tokens with no consumer", () => {
    for (const k of [
      "--grid", "--grid-size", "--bezel-pad", "--bezel-outer",
      "--bezel-inner", "--shadow-lip", "--z-grain",
    ]) {
      expect(t[k]).toBeUndefined();
    }
  });
});
