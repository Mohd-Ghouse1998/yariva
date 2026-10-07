import rootSource from "./MyProfileScreen.tsx?raw";
import editorSource from "./EditProfileScreen.tsx?raw";
import settingsSource from "../settings/SettingsScreen.tsx?raw";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Check the actual JSX destinations, not a second list that can drift from rendering.
function rows(contents: string): string[] {
  const source = ts.createSourceFile(
    "screen.tsx",
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(source) === "NavigationListRow"
    ) {
      for (const prop of node.attributes.properties)
        if (
          ts.isJsxAttribute(prop) &&
          prop.name.getText(source) === "label" &&
          prop.initializer &&
          ts.isStringLiteral(prop.initializer)
        )
          labels.push(prop.initializer.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return labels;
}
describe("Profile navigation ownership", () => {
  it("keeps field editors inside Edit profile only", () => {
    const root = rows(rootSource),
      editor = rows(editorSource);
    expect(rootSource).toContain('accessibilityLabel="Edit profile"');
    expect(rootSource).toContain(
      'accessibilityLabel="My Vibe. Open your five-second introduction."',
    );
    expect(rootSource).toContain('router.push("/(app)/vibe")');
    expect(root.filter((label) => editor.includes(label))).toEqual([]);
    expect(root).not.toEqual(
      expect.arrayContaining(["Interests", "Manage photos", "Schedule", "Intent"]),
    );
    expect(new Set(editor).size).toBe(editor.length);
  });
  it("opens each social relationship list from its own visible stat", () => {
    expect(rootSource).toContain('key: "followers", label: "Followers"');
    expect(rootSource).toContain('key: "following", label: "Following"');
    expect(rootSource).toContain('key: "requests", label: "Requests"');
    expect(rootSource).toContain("onPress={() => openFollowTab(stat.key)}");
    expect(rootSource).toContain('pathname: "/(app)/private-stories/follows", params: { tab }');
  });
  it("keeps privacy, logout and account editing out of duplicate menus", () => {
    const root = rows(rootSource),
      settings = rows(settingsSource);
    expect(root.filter((label) => settings.includes(label))).toEqual([]);
    expect(settings).not.toContain("Basic details");
    expect(settings).toContain("Log out");
    expect(root).not.toContain("Settings"); // Single settings entry is the tab-header gear.
  });
});
