type TocHeading = {
  depth: number;
  slug: string;
  text: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildTocHtml = (items: TocHeading[]) => {
  if (!items?.length) return "";
  const list = items
    .map((item) => {
      const text = escapeHtml(item.text);
      const slug = item.slug;
      return `<li class="li li-${item.depth}"><a href="#${slug}" id="link-${slug}" class="toc-a">${text}</a></li>`;
    })
    .join("");
  return `<div class="dir"><ul id="toc">${list}</ul><div class="sider"><span class="siderbar"></span></div></div>`;
};
