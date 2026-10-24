# Privacy Policy for Copy Title and URL

Last updated: October 25, 2026

Copy Title and URL is a Chrome extension that copies the title and URL of the current page, formatted by rules you control. This policy explains what the extension does with your data. It applies to the extension and its settings page.

## Summary

- The extension does not send your data to the developer or to any third party.
- It makes no network requests.
- It reads the current page's title and URL only when you choose a copy command, and only in the tab you are on.
- Your rules and settings are stored by Chrome and synced by Chrome sync. The developer cannot access them.

## Data the extension handles

### Page title and URL

When you choose **Copy title and URL** from the context menu or the toolbar popup, the extension reads the title and URL of the active tab to build the text you asked for. It does not store the title or URL, and it does not send them anywhere. The text is written to your clipboard. This is the only time the extension reads page data.

For the Chrome Web Store data disclosure: the extension handles website content (the title and URL of the current page) locally, on your device, only when you invoke it. It does not transmit, sell, or share this data, and it does not keep a history of the pages you visit.

### Rules and settings

The rules and settings you create are stored in `chrome.storage.sync`. If Chrome sync is turned on, Chrome syncs them across the browsers signed in to your Google account. Google's handling of synced data is covered by Google's privacy policy. The developer of this extension cannot access your rules or settings.

## What the extension does not do

- No network requests. The extension has no servers and sends no data.
- No analytics, telemetry, advertising, or tracking.
- No selling or sharing of data.
- No remote code. All code is included in the extension package.
- No access to pages you have not chosen to copy from. The extension does not request host permissions. It uses the `activeTab` permission, which grants access to the current tab only after you invoke the extension.

## Limited use

The extension uses the data it handles only to provide its single purpose: copying the title and URL you ask for. It does not use or transfer data for advertising, creditworthiness, lending, or any purpose unrelated to that single purpose.

## Permissions

| Permission | Why the extension needs it |
| --- | --- |
| `contextMenus` | Adds the **Copy title and URL** submenu to the page context menu. |
| `activeTab` | Lets the extension access the current tab only after you invoke it, so it can read the title and write the clipboard without host permissions. |
| `scripting` | Runs a small bundled script in the current tab to read the title element and write the copied text. |
| `storage` | Stores your rules and settings in `chrome.storage.sync`. |

## Data retention and deletion

The extension does not retain page titles or URLs.

Rules and settings remain in `chrome.storage.sync` until you delete them. You can:

- Delete individual rules, or reset built-in rules, on the settings page.
- Remove the extension. This deletes its local data. Data synced by Chrome may remain in your Google account until it is removed from Chrome sync.
- Manage or delete synced data at `chrome://settings/syncSetup`.

## Children

The extension is a general-purpose utility and is not directed at children. It does not knowingly collect data from anyone.

## Changes

If this policy changes, the updated version will be published at this URL with a new "Last updated" date.

## Contact

For questions or requests about this policy, open an issue at <https://github.com/jsoizo/copy-title-url/issues>.
