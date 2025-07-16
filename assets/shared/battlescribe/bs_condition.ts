import type { EditorBase } from "./bs_main_catalogue";

export const validScopes = new Set([
  "force",
  "roster",
  "self",
  "parent",
  "ancestor",
  "primary-category",
  "force",
  "roster",
  "primary-catalogue",
  "root-entry", "unit", "model", "upgrade", "model-or-unit"
]);
export const validChildIds = new Set(["any", "unit", "model", "upgrade", "mount", "crew"]);
export function isScopeValid(parent: EditorBase, scope: string) {
  if (validScopes.has(scope)) return true;
  const catalogue = parent.catalogue;
  const found = catalogue.findOptionById(scope);
  if (found) {
    if (found.isForce() && !parent.isForce()) return true;
    if (found.isCategory()) return true;
    if (found.isCatalogue()) return true;
  }
  const stack = [parent];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.id === scope) return true;
    if (current.parent) stack.push(current.parent);
    if (current.refs) stack.push(...current.refs)
  }
  return false;
}
