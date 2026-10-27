const REPOSITORY = "jsoizo/copy-title-url";

type ManifestVersion = { version: string; version_name?: string };

// release.yml はタグ v<package.json の version> からリリースするので、インストールした版と同じタグのファイルを指せる
// プレリリースの接尾辞は manifest の version に入らず version_name だけに残る
function releaseTag({ version, version_name }: ManifestVersion): string {
  return `v${version_name ?? version}`;
}

export const schemaUrl = (manifest: ManifestVersion): string =>
  `https://raw.githubusercontent.com/${REPOSITORY}/${releaseTag(manifest)}/schema/rules.schema.json`;

export const rulesDocUrl = (manifest: ManifestVersion): string =>
  `https://github.com/${REPOSITORY}/blob/${releaseTag(manifest)}/README.md#rules`;
