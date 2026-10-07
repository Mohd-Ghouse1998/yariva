import { describe, expect, it } from "vitest";
import ts from "typescript";
import source from "./ScenesPanel.tsx?raw";
import { sceneMineAction } from "./sceneTime";

describe("explicit Scene renewal", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  it("opens review for expired/ended scenes, never treats them as active", () => {
    expect(sceneMineAction(null, now)).toBe("CREATE");
    expect(sceneMineAction({ status: "ACTIVE", expiresAt: "2026-09-29T13:00:00Z" }, now)).toBe(
      "VIEW",
    );
    expect(sceneMineAction({ status: "ACTIVE", expiresAt: "2026-09-29T12:00:00Z" }, now)).toBe(
      "REVIEW_RENEW",
    );
    expect(sceneMineAction({ status: "ENDED", expiresAt: "2026-09-30T13:00:00Z" }, now)).toBe(
      "REVIEW_RENEW",
    );
  });
  it("does not invoke renewal in the actual tile handler", () => {
    const ast = ts.createSourceFile(
      "ScenesPanel.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let handler: ts.VariableDeclaration | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "openMine") handler = node;
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(handler).toBeDefined();
    const calls: string[] = [];
    const collect = (node: ts.Node) => {
      if (ts.isCallExpression(node)) calls.push(node.expression.getText(ast));
      ts.forEachChild(node, collect);
    };
    collect(handler!);
    expect(calls).toContain("setRenewReviewOpen");
    expect(calls).not.toContain("renew");
    expect(calls).not.toContain("scenesApi.renew");
  });
  it("keeps one owner circle for Scene viewing and creation without inactive status copy", () => {
    const rail = source.split("<ScrollView")[1]?.split("</ScrollView>")[0];
    expect(rail).toContain("<OwnerTile");
    expect(rail).not.toContain("<MineTile");
    expect(rail).not.toContain("<CreateTile");
    const tile = source.split("const OwnerTile:")[1]?.split("const CandidateTile:")[0];
    expect(tile).toBeDefined();
    expect(tile).not.toContain("scene.expiredRenew");
    expect(tile).not.toContain("scene.endedRenew");
    expect(tile).toContain('t("scene.viewMine")');
    expect(tile).toContain('t("scene.renewReview")');
    expect(tile).toContain("onPress={scene || hasStory ? onOpen : onCreate}");
    expect(tile).toContain("onPress={onCreate}");
    expect(rail).toContain("<PrivateStoryTiles");
    expect(source).not.toContain("<PrivateStoriesRail");
  });
});
