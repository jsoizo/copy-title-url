# Copy Title and URL

Copy Title and URL is a Chrome extension that copies the title and URL of the current page, cleaned up per site by rules you can edit, without requesting access to your site data.

On a GitHub pull request, for example, it copies `Fix the login form #9000` and `https://github.com/owner/repo/pull/9000` even when you are on `/pull/9000/files?diff=split`.

## Features

- Copy as plain text (title and URL on two lines) or as a Markdown link, from the context menu or the toolbar popup.
- Built-in rules for GitHub issues, pull requests, and discussions, and for Jira issues on Atlassian Cloud.
- Add your own rules: match the URL with [URLPattern](https://developer.mozilla.org/docs/Web/API/URL_Pattern_API) or a regular expression, read the title from CSS selectors, and rebuild the label and URL from templates.
- Pages that match no rule are copied with the page title and URL as they are.
- Edit, reorder, disable, import, and export rules on the settings page. Rules sync across your browsers with Chrome sync.
- English and Japanese UI.

The extension requests only `contextMenus`, `activeTab`, `scripting`, and `storage`. It does not request host permissions, so Chrome shows no "read and change your data on websites" warning. It reads a page only when you click a menu item or the toolbar button. The extension itself makes no network requests; your rules are synced by Chrome sync.

## Requirements

- Google Chrome 95 or later, or another Chromium-based browser of the same version

Firefox is not supported.

## Install

The extension is not on the Chrome Web Store. Install it from a release:

1. Download `copy-title-url-<version>-chrome.zip` from the [Releases](https://github.com/jsoizo/copy-title-url/releases) page and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped directory.

Chrome does not update unpacked extensions automatically. For releases with the same ID, replace the contents of the loaded directory with the new release and click the reload button on `chrome://extensions`. Do not remove the extension to update it, and export your rules from the settings page before you remove it.

The extension ID is fixed to `nfibbddcoilbgjplanohcjgolkapdaej` whichever directory you load it from. This is the same ID as the Chrome Web Store item, so unpacked builds and the store version share their synced rules. After you load it in each browser, your rules sync across browsers signed in to the same Google account with Chrome sync turned on.

If you installed 0.1.0 from a release, export your rules from its settings page before upgrading. 0.1.1 uses the Chrome Web Store item's ID, so the old unpacked extension and its synced rules are not carried over automatically. After exporting, remove the 0.1.0 build, load 0.1.1, and import the file.

## Usage

Right-click on the page (not on a link, an image, or a text field) and choose **Copy title and URL**, or click the toolbar button, then pick a format:

| Format | Output |
|---|---|
| As plain text | `Fix the login form #9000`<br>`https://github.com/owner/repo/pull/9000` |
| As Markdown link | `[Fix the login form #9000](https://github.com/owner/repo/pull/9000)` |

A toast in the bottom-right corner of the page shows the result. When you copy from the popup and the toast cannot be shown, the popup shows the result instead. If a rule matches but its title element is not on the page yet, the extension falls back to the page title and shows a warning.

To open the settings page, choose **Open settings** from the same menu or popup.

## Rules

Rules are evaluated from the top of the list on the settings page. The first rule that matches the page URL is used.

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID made of lowercase letters, digits, and `-`. The settings page generates one for new rules |
| `name` | Yes | Name shown in the list. Up to 100 characters, and different from the names of other rules |
| `match` | Yes | One or more URL conditions, tried in order |
| `match[].type` | Yes | `urlpattern` or `regex` |
| `match[].pattern` | Yes | A URLPattern pattern string or a regular expression |
| `match[].query` | No | `urlpattern` only. Maps variable names to query parameters, which must be present and non-empty |
| `match[].documentTitleFallback` | No | Set to `false` to show an error instead of falling back to the page title |
| `title.selectors` | Yes | CSS selectors for the title element, tried in order. With an empty list, the page title is used |
| `title.documentTitleStrip` | No | Regular expressions removed from the page title whenever it is used. Each one removes only its first match |
| `label` | Yes | Template for the label |
| `url` | Yes | Template for the URL. It must produce an absolute URL that starts with `http://` or `https://`, unless it starts with a variable captured by `match` |

Leading and trailing spaces are removed from `name`, URLPattern patterns, query parameters, and selectors. Regular expressions and templates are kept as they are, because spaces can be meaningful there. A value that contains only spaces counts as empty.

A `urlpattern` condition is matched against the URL without its query and hash, and its named groups become variables. A `regex` condition is tested against the full URL, including the query and hash, with the `u` flag. Its named capture groups become variables. Add `^` and `$` to anchor it.

Every condition must capture all variables that `label` and `url` use. If a condition matches but an optional group leaves a variable empty, the condition is skipped and the next one is tried.

Templates replace `{name}` with a variable. Write `{{` and `}}` for literal braces.

| Variable | Value |
|---|---|
| Named groups from `match` | The matched part of the URL, or the value of the query parameter mapped in `query` |
| `title` | The title read from the page (`label` only) |
| `host` | The page's host, including the port |
| `origin` | The page's origin |

You can edit rules with the form on the settings page, where each field corresponds to the JSON below. This rule copies [Kibela](https://kibe.la) notes as the note title and the note URL without the comment fragment:

```json
{
  "id": "kibela",
  "name": "Kibela",
  "match": [{ "type": "urlpattern", "pattern": "https://*.kibe.la/notes/:id(\\d+){/*}?" }],
  "title": { "selectors": ["h1.noteHeader-title"], "documentTitleStrip": ["\\s\\|\\s[^|]*Kibela$"] },
  "label": "{title}",
  "url": "https://{host}/notes/{id}"
}
```

This rule copies issues from a self-hosted Jira with a regular expression:

```json
{
  "id": "my-jira",
  "name": "My Jira",
  "match": [{ "type": "regex", "pattern": "^https://jira\\.example\\.com/browse/(?<key>[A-Z][A-Z0-9_]*-[1-9]\\d*)(?:[/?#]|$)" }],
  "title": { "selectors": [], "documentTitleStrip": ["^\\[[^\\]]+\\]\\s*", "\\s*-\\s*Jira$"] },
  "label": "{key} {title}",
  "url": "https://{host}/browse/{key}"
}
```

Exported files contain your own rules, the built-in rules you edited, the order of the list, and which rules are disabled. Unedited built-in rules are left out, so they keep following updates to the extension. To import a rule written by hand, put it in the `rules` array of an exported file. The format is described by [`schema/rules.schema.json`](schema/rules.schema.json). Importing a file replaces all current settings.

## Build from source

You need Node.js 24 or later and pnpm 12. The tests use the global `URLPattern`, and `pnpm schema` runs a TypeScript file directly with Node.js; both need Node.js 24.

```bash
git clone https://github.com/jsoizo/copy-title-url.git
cd copy-title-url
pnpm install
pnpm build
```

Load `.output/chrome-mv3` with **Load unpacked**. A build from source has the same extension ID as the release ZIP and the Chrome Web Store version, so it shares synced rules with them. `pnpm dev` runs in a separate browser profile and does not affect them.

| Command | Description |
|---|---|
| `pnpm dev` | Build in watch mode and reload the extension on changes |
| `pnpm build` | Build into `.output/chrome-mv3` |
| `pnpm zip` | Build and create the release zip in `.output` (includes `manifest.key` for unpacked installs) |
| `pnpm zip:store` | Build and create the Chrome Web Store zip in `.output` (omits `manifest.key`) |
| `pnpm test` | Run the unit tests |
| `pnpm check` | Type-check |
| `pnpm schema` | Regenerate `schema/rules.schema.json` |
| `pnpm icons` | Regenerate the PNG icons from `assets/icon.svg` (requires a POSIX shell and `rsvg-convert`) |

The Chrome Web Store rejects `manifest.key`. Use `pnpm zip:store` for store uploads; `pnpm zip` is for GitHub releases and unpacked installs.

## FAQ

### Why doesn't it work on some pages?

Chrome does not let extensions run on pages such as `chrome://` URLs and the Chrome Web Store. On those pages, the popup shows an error. The context menu shows nothing on the page and only logs the error to the extension's service worker console.

To use the extension on `file://` pages, turn on **Allow access to file URLs** on the extension's details page in `chrome://extensions`.

### Why doesn't the menu text change to match the site?

Updating the menu for each page requires the `tabs` permission. The extension keeps its permissions minimal, so the menu text stays the same on every page.

### Why does it need the `scripting` permission?

The extension reads the title element and writes to the clipboard by running a script in the current tab. Combined with `activeTab`, it can do this only in the tab you clicked, and only at that moment.

## License

Copy Title and URL is available under the [MIT License](LICENSE).
