// TypeScript 5.9 の lib.dom に URLPattern が無いため、使う範囲だけを宣言する
type URLPatternComponentResult = {
  input: string;
  groups: Record<string, string | undefined>;
};

type URLPatternResult = Record<
  "protocol" | "username" | "password" | "hostname" | "port" | "pathname" | "search" | "hash",
  URLPatternComponentResult
>;

declare class URLPattern {
  constructor(input: string, baseURL?: string);
  exec(input: string): URLPatternResult | null;
  test(input: string): boolean;
}
