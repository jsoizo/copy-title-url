const ITEM_TYPES = new Set(["issues", "pull", "discussions"]);

export function parseItemUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.host !== "github.com") return null;

  const [owner, repo, type, number] = url.pathname.split("/").slice(1);
  if (!owner || !repo || !ITEM_TYPES.has(type) || !/^[1-9]\d*$/.test(number ?? "")) {
    return null;
  }
  return {
    number,
    url: `https://github.com/${owner}/${repo}/${type}/${number}`,
  };
}

export function normalizeTitle(rawTitle) {
  if (typeof rawTitle !== "string") return "";
  return rawTitle.replace(/[ \t\n\r\f]+/g, " ").trim();
}

export function formatOutput(title, item) {
  return `${title} #${item.number}\n${item.url}`;
}
