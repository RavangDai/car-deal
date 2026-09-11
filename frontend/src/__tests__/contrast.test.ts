import { describe, it, expect } from "vitest";
import { contrastRatio, relativeLuminance, parseTokens } from "./contrast";

describe("contrast helper", () => {
  it("computes known luminance endpoints", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("computes the maximum contrast ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#2563eb", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#2563eb"),
      5,
    );
  });

  it("matches a verified reference pair", () => {
    // gray-700 on white, verified during design.
    expect(contrastRatio("#374151", "#ffffff")).toBeCloseTo(10.31, 1);
  });

  it("accepts shorthand hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 2);
  });

  it("parses custom properties out of CSS text", () => {
    const css = ":root {\n  --ink: #111827;\n  --rule:  #e5e7eb;\n}";
    expect(parseTokens(css)).toEqual({ "--ink": "#111827", "--rule": "#e5e7eb" });
  });
});
