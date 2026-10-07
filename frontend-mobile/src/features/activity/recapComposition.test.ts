import { describe, expect, it } from "vitest";
import ts from "typescript";
import source from "./RecapShareCard.tsx?raw";

describe("native recap export composition", () => {
  it("uses one root SVG, not nested viewports that can clip later card content", () => {
    const ast = ts.createSourceFile(
      "card.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let roots = 0;
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(ast) === "Svg"
      )
        roots++;
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(roots).toBe(1);
    expect(source).toContain("<SvgImage");
    expect(source).toContain("wordmark-light.png"); // Supplied letterform, not recreated letters.
  });
});
