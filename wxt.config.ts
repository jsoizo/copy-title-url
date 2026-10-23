import preact from "@preact/preset-vite";
import { defineConfig } from "wxt";

export default defineConfig({
  imports: false,
  manifest: {
    name: "Copy Title and URL",
    description: "Copy the title and URL of the current page, formatted per site with configurable rules.",
    default_locale: "en",
    permissions: ["contextMenus", "activeTab", "scripting", "storage"],
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
