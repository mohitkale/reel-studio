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
  document.body.innerHTML = "";
});
describe("native reading-frame measurements", () => {
  it("uses native canvas coordinates and ignores decorative chrome", () => {
    expect(measureReviewLayout(fixture(), layout, 39)).toEqual({
      frame: 39,
      checkedTextNodes: 1,
      truncated: false,
      issues: [],
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
