import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  CheckCircle,
  ReceiptRefund,
  ExclamationTriangle,
  ChevronDown,
  ChevronRight,
  Home,
  Heart,
  TrendUp,
  TrendDown,
  Cog,
  ChatBubble,
} from "./icons";

const ALL = {
  CheckCircle,
  ReceiptRefund,
  ExclamationTriangle,
  ChevronDown,
  ChevronRight,
  Home,
  Heart,
  TrendUp,
  TrendDown,
  Cog,
  ChatBubble,
};

describe("icons", () => {
  it("hides every icon from assistive tech", () => {
    for (const [name, Icon] of Object.entries(ALL)) {
      const { container } = render(<Icon />);
      expect(container.querySelector("svg")!.getAttribute("aria-hidden"), name).toBe("true");
    }
  });

  it("passes className through on every icon", () => {
    for (const [name, Icon] of Object.entries(ALL)) {
      const { container } = render(<Icon className="size-5 shrink-0" />);
      expect(container.querySelector("svg")!.getAttribute("class"), name).toBe("size-5 shrink-0");
    }
  });

  it("bakes no size into any icon", () => {
    for (const [name, Icon] of Object.entries(ALL)) {
      const svg = render(<Icon />).container.querySelector("svg")!;
      expect(svg.hasAttribute("width"), name).toBe(false);
      expect(svg.hasAttribute("height"), name).toBe(false);
    }
  });

  it("use the reference set's 1.5 stroke weight", () => {
    for (const [name, Icon] of Object.entries(ALL)) {
      if (name === "ChevronRight") continue; // solid glyph, no stroke-width
      const { container } = render(<Icon />);
      expect(container.querySelector("svg")!.getAttribute("stroke-width"), name).toBe("1.5");
    }
  });

  it("keeps ChevronRight as a solid 20-viewBox glyph, unlike the outline set", () => {
    const svg = render(<ChevronRight />).container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 20 20");
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.hasAttribute("stroke-width")).toBe(false);
  });

  it("renders every exported icon without throwing", () => {
    for (const [name, Icon] of Object.entries(ALL)) {
      const { container } = render(<Icon />);
      expect(container.querySelector("svg"), name).toBeTruthy();
    }
  });
});
