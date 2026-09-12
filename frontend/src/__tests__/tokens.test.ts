import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastRatio, parseTokens } from "./contrast";

const css = readFileSync(resolve(__dirname, "../theme.css"), "utf8");
const t = parseTokens(css);

const WHITE = "#ffffff";

describe("palette values", () => {
  it("carries the two brand colours", () => {
    expect(t["--navy"]).toBe("#101827");
    expect(t["--mint"]).toBe("#a8f0cb");
  });

  it("uses the DealOwl surfaces", () => {
    expect(t["--paper"]).toBe("#ffffff");
    expect(t["--ground"]).toBe("#f6f8f7");
    expect(t["--paper-soft"]).toBe("#f6f8f7");
    expect(t["--plate"]).toBe("#f4f5f7");
  });

  it("runs the ink ramp in the navy family", () => {
    expect(t["--ink"]).toBe("#101827");
    expect(t["--ink-soft"]).toBe("#2c3a4f");
    expect(t["--ink-muted"]).toBe("#52627a");
    expect(t["--ink-fade"]).toBe("#5c6b82");
  });

  it("keeps --ink and --primary the SAME navy", () => {
    // Two near-identical navies one channel apart is the classic way a
    // palette rots. They are one colour here, and this pins it.
    expect(t["--primary"]).toBe(t["--ink"]);
  });

  it("retires the blue accent into the navy family", () => {
    // The --blue-* names survive only because a few call sites still read
    // them. Nothing may render blue: they resolve to navy or savings green.
    expect(t["--blue"]).toBe("#101827");
    expect(t["--link"]).toBe("#101827");
  });

  it("spends green on savings only", () => {
    expect(t["--green"]).toBe("#087f5b");
  });

  it("maps structure to the slate border ramp", () => {
    expect(t["--rule"]).toBe("#e2e8f0");
  });

  it("uses the 12-16px card radius band", () => {
    expect(t["--r-card"]).toBe("12px");
    expect(t["--r-xl"]).toBe("16px");
    expect(t["--r-pill"]).toBe("999px");
  });

  it("loads Manrope for display and Inter for body", () => {
    expect(t["--font-display"]).toContain("Manrope");
    expect(t["--font-sans"]).toContain("Inter");
  });
});

describe("the mint rule", () => {
  // Mint is the one colour in this system that can be used catastrophically
  // wrong, so the rule is a test rather than a comment.
  const MINT = "#a8f0cb";

  it("carries navy text at AAA", () => {
    expect(contrastRatio(t["--ink"], MINT)).toBeGreaterThanOrEqual(7);
  });

  it("still carries navy text in its pressed state", () => {
    expect(contrastRatio(t["--ink"], t["--mint-deep"])).toBeGreaterThanOrEqual(4.5);
  });

  it("is UNUSABLE as text on light - this is the point, not a bug", () => {
    // 1.31:1 on white, 1.23:1 on the page. Mint is a FILL on light surfaces
    // and whatever sits on it is navy. If someone "fixes" mint by darkening
    // it until this passes, they have changed the brand, and this fails loudly.
    expect(contrastRatio(MINT, WHITE)).toBeLessThan(3);
    expect(contrastRatio(MINT, t["--ground"])).toBeLessThan(3);
  });

  it("is legible as text only on navy", () => {
    expect(contrastRatio(MINT, t["--navy"])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a white card distinguishable from the page only via the border", () => {
    // white-on-page is 1.07:1, so the card edge IS the border. Losing
    // --rule would make every card dissolve into the page.
    expect(contrastRatio(t["--paper"], t["--ground"])).toBeLessThan(1.2);
    expect(t["--rule"]).toBeDefined();
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

  it("on-navy text clears AA", () => {
    expect(contrastRatio(t["--on-navy"], t["--navy"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--on-navy-muted"], t["--navy"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the savings figure clears AA both as fill and as text", () => {
    expect(contrastRatio(WHITE, t["--green"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--green"], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--green"], t["--ground"])).toBeGreaterThanOrEqual(4.5);
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

describe("the glass token set (chrome layer)", () => {
  it("defines all six --glass-* tokens", () => {
    for (const k of [
      "--glass-fill", "--glass-fill-strong", "--glass-blur",
      "--glass-blur-deep", "--glass-lip", "--glass-edge",
    ]) {
      expect(t[k]).toBeDefined();
    }
  });

  it("fills are white-based rgba, not the old warm island tint", () => {
    expect(t["--glass-fill"]).toMatch(/^rgba\(255,\s*255,\s*255,/);
    expect(t["--glass-fill-strong"]).toMatch(/^rgba\(255,\s*255,\s*255,/);
  });
});
