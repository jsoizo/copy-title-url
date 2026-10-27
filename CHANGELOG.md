# Changelog

All notable user-visible changes to Tidy Title & URL will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Exported files include `$schema`, which points to the JSON Schema of the installed version, so editors can check and complete rules you write by hand.
- The settings page links to the rule format in the README.

### Changed

- The extension is renamed from Copy Title and URL to Tidy Title & URL, so it can be told apart from another Chrome Web Store item with the same name. Your rules and settings are kept.
- The extension description now names the sites that have built-in rules (GitHub and Jira), and is shown in Japanese when the browser language is Japanese.

## [0.1.1] - 2026-10-25

### Changed

- The extension ID now matches the Chrome Web Store item. Unpacked builds and the store version share the same extension ID and Chrome sync rules. If you installed 0.1.0 from a release, export your rules before upgrading; the extension ID has changed.

### Fixed

- The Chrome Web Store ZIP is built without the `manifest.key` field, which the store rejects.

## [0.1.0] - 2026-10-24

First public release.

### Added

- Copy the current page as plain text (title and URL on two lines) or as a Markdown link from the context menu or the toolbar popup.
- Declarative site rules that match the page URL with URLPattern or a regular expression, read the title from CSS selectors, and rebuild the label and URL from templates.
- Built-in rules for GitHub issues, pull requests, and discussions, and for Jira issues on Atlassian Cloud. Built-in rules can be edited, disabled, and reset.
- Pages that match no rule are copied with the page title and URL as they are.
- An options page to add, edit, reorder, enable, and disable rules, and to import and export them as JSON.
- Rules are checked when you save or import them: names must be unique and up to 100 characters, values that contain only spaces count as empty, and the URL template must produce an absolute `http` or `https` URL. Leading and trailing spaces are removed from names, URLPattern patterns, query parameters, and selectors.
- Validation errors are shown under each field in your language, and imports name the rule and field that failed.
- English and Japanese UI.
- The extension requests only `contextMenus`, `activeTab`, `scripting`, and `storage`, without host permissions.

[Unreleased]: https://github.com/jsoizo/copy-title-url/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/jsoizo/copy-title-url/releases/tag/v0.1.1
[0.1.0]: https://github.com/jsoizo/copy-title-url/releases/tag/v0.1.0
