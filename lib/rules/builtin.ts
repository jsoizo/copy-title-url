import type { Rule } from "./schema";

export const BUILTIN_RULES: readonly Rule[] = [
  {
    id: "github",
    name: "GitHub",
    match: [
      {
        type: "urlpattern",
        pattern: String.raw`https://github.com/:owner/:repo/:type(issues|pull|discussions)/:number([1-9]\d*){/*}?`,
      },
    ],
    title: {
      selectors: ["h1 .markdown-title"],
      documentTitleStrip: [
        String.raw`(?: by [^\s·]+)? · (?:Issue|Pull Request) #\d+ · [^·]+(?: · GitHub)?$`,
        String.raw` · [^·]+ · Discussion #\d+(?: · GitHub)?$`,
      ],
    },
    label: "{title} #{number}",
    url: "https://github.com/{owner}/{repo}/{type}/{number}",
  },
  {
    id: "jira",
    name: "Jira",
    match: [
      { type: "urlpattern", pattern: String.raw`https://*.atlassian.net/browse/:key([A-Z][A-Z0-9_]*-[1-9]\d*)` },
      {
        type: "urlpattern",
        pattern: "https://*.atlassian.net/*",
        query: { key: "selectedIssue" },
        // ボードやバックログでは document.title がボード名のままなので代用しない
        documentTitleFallback: false,
      },
    ],
    title: {
      selectors: ["[data-testid='issue.views.issue-base.foundation.summary.heading']"],
      documentTitleStrip: [String.raw`^\[[^\]]+\]\s*`, String.raw`\s-\s[^-]*Jira$`],
    },
    label: "{key} {title}",
    url: "https://{host}/browse/{key}",
  },
  {
    id: "kibela",
    name: "Kibela",
    match: [{ type: "urlpattern", pattern: String.raw`https://*.kibe.la/notes/:id(\d+){/*}?` }],
    title: {
      selectors: ["h1.noteHeader-title"],
      documentTitleStrip: [String.raw`\s\|\s[^|]*Kibela$`],
    },
    label: "{title}",
    url: "https://{host}/notes/{id}",
  },
];
