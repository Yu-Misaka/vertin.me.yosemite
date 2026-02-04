import { visit } from "unist-util-visit";

export default function rehypeWrapTables() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (node.tagName !== "table") return;

      const parentIsWrapper =
        parent.type === "element" &&
        parent.tagName === "div" &&
        Array.isArray(parent.properties?.className) &&
        parent.properties.className.includes("table-scroll");

      if (parentIsWrapper) return;

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"] },
        children: [node]
      };
    });
  };
}
