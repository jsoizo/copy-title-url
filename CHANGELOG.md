# Changelog

All notable user-visible changes to Copy Title and URL will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-23

First public release.

### Added

- Copy the current page as plain text (title and URL on two lines) or as a Markdown link from the context menu or the toolbar popup.
- Declarative site rules that match the page URL with URLPattern or a regular expression, read the title from CSS selectors, and rebuild the label and URL from templates.
- Built-in rules for GitHub issues, pull requests, and discussions, and for Jira issues on Atlassian Cloud. Built-in rules can be edited, disabled, and reset.
- Pages that match no rule are copied with the page title and URL as they are.
- An options page to add, edit, reorder, enable, and disable rules, and to import and export them as JSON.
- English and Japanese UI.
- The extension requests only `contextMenus`, `activeTab`, `scripting`, and `storage`, without host permissions.

[Unreleased]: https://github.com/jsoizo/copy-title-url/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jsoizo/copy-title-url/releases/tag/v0.2.0
