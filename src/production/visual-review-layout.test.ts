import { afterEach, describe, expect, it, vi } from "vitest";
import { measureReviewLayout } from "./visual-review-layout";
import { resolveProductionLayout } from "./layout";

const layout = resolveProductionLayout({ width: 1080, height: 1920 });
function fixture(bounds = [120, 200, 700, 300]) {
  document.body.innerHTML =
    '<div id="root"><div data-review-content><div id="copy">Readable copy</div></div><div>Brand bug</div></div>';
  const root = document.getElementById("root")!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 540, 960),
  );
  vi.spyOn(document, "createRange").mockReturnValue({
    selectNodeContents: vi.fn(),
    getClientRects: () => [
      new DOMRect(
        bounds[0] / 2,
        bounds[1] / 2,
        (bounds[2] - bounds[0]) / 2,
        (bounds[3] - bounds[1]) / 2,
      ),
    ],
  } as unknown as Range);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element) =>
      ({
        opacity: element.getAttribute("data-opacity") ?? "1",
        display: "block",
        visibility: "visible",
        overflowX: element.getAttribute("data-clip") ? "hidden" : "visible",
        overflowY: "visible",
      }) as CSSStyleDeclaration,
  );
  return root;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
describe("native reading-frame measurements", () => {
  it("uses native canvas coordinates and ignores decorative chrome", () => {
    expect(measureReviewLayout(fixture(), layout, 39)).toEqual({
      frame: 39,
      checkedTextNodes: 1,
      truncated: false,
      issues: [],
      contrastSamples: [],
    });
  });
  it("distinguishes safe-area breaches from canvas clipping", () => {
    expect(
      measureReviewLayout(fixture([20, 200, 700, 300]), layout, 39).issues[0],
    ).toMatchObject({ kind: "safe-area", bounds: { left: 20 } });
    expect(
      measureReviewLayout(fixture([-20, 200, 700, 300]), layout, 39).issues[0]
        .kind,
    ).toBe("text-clipping");
  });
  it("checks clipping ancestors and skips intentional revealing layers", () => {
    const root = fixture();
    const copy = document.getElementById("copy")!;
    copy.setAttribute("data-clip", "true");
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue(
      new DOMRect(60, 100, 100, 100),
    );
    expect(measureReviewLayout(root, layout, 39).issues[0].kind).toBe(
      "text-clipping",
    );
    copy.setAttribute("data-opacity", "0.5");
    expect(measureReviewLayout(root, layout, 39).checkedTextNodes).toBe(0);
  });
  it("uses native glyph metrics to avoid false clipping from unused font ascent/descent", () => {
    const root = fixture([120, 200, 700, 300]);
    vi.stubGlobal("CanvasRenderingContext2D", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      measureText: () => ({
        fontBoundingBoxAscent: 80,
        fontBoundingBoxDescent: 20,
        actualBoundingBoxAscent: 60,
        actualBoundingBoxDescent: 10,
      }),
    } as unknown as CanvasRenderingContext2D);
    const copy = document.getElementById("copy")!;
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue(
      new DOMRect(60, 110, 300, 35),
    );
    vi.mocked(window.getComputedStyle).mockImplementation(
      (element) =>
        ({
          opacity: "1",
          display: "block",
          visibility: "visible",
          overflowX: "visible",
          overflowY: element === copy ? "hidden" : "visible",
          fontSize: "100px",
          fontFamily: "sans-serif",
        }) as CSSStyleDeclaration,
    );
    expect(measureReviewLayout(root, layout, 39).issues).toEqual([]);
  });
  it("collects opaque native foregrounds and skips shadows, gradients and blending", () => {
    const root = fixture();
    const style = {
      opacity: "1",
      display: "block",
      visibility: "visible",
      overflowX: "visible",
      overflowY: "visible",
      color: "rgb(80, 80, 80)",
      fontSize: "24px",
      fontWeight: "700",
      textShadow: "none",
      filter: "none",
      mixBlendMode: "normal",
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration;
    vi.mocked(window.getComputedStyle).mockReturnValue(style);
    expect(measureReviewLayout(root, layout, 39).contrastSamples).toHaveLength(
      1,
    );
    expect(
      measureReviewLayout(root, layout, 39).contrastSamples![0],
    ).toMatchObject({ color: [80, 80, 80], minimumRatio: 3 });
    vi.mocked(window.getComputedStyle).mockReturnValue({
      ...style,
      textShadow: "1px 1px black",
    } as CSSStyleDeclaration);
    expect(measureReviewLayout(root, layout, 39).contrastSamples).toEqual([]);
    vi.mocked(window.getComputedStyle).mockReturnValue({
      ...style,
      mixBlendMode: "difference",
    } as CSSStyleDeclaration);
    expect(measureReviewLayout(root, layout, 39).contrastSamples).toEqual([]);
    vi.mocked(window.getComputedStyle).mockReturnValue({
      ...style,
      getPropertyValue: () => "transparent",
    } as CSSStyleDeclaration);
    expect(measureReviewLayout(root, layout, 39).contrastSamples).toEqual([]);
  });
  it("preserves the budget for visible late-chapter copy after inactive scenes", () => {
    const root = fixture();
    root.insertAdjacentHTML(
      "afterbegin",
      '<div data-opacity="0"><div>Inactive copy</div></div>'.repeat(600),
    );
    expect(measureReviewLayout(root, layout, 9999)).toMatchObject({
      checkedTextNodes: 1,
      truncated: false,
      issues: [],
    });
  });
  it("bounds text traversal and findings", () => {
    const root = fixture([-20, 200, 700, 300]);
    root.querySelector("[data-review-content]")!.innerHTML =
      "<div>Overflow</div>".repeat(600);
    const result = measureReviewLayout(root, layout, 39);
    expect(result.issues).toHaveLength(8);
    expect(result.checkedTextNodes).toBe(512);
    expect(result.truncated).toBe(true);
  });
});
