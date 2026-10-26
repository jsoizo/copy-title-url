import preact from "@preact/preset-vite";
import { defineConfig } from "wxt";

// Chrome Web Store の Package タブに表示される公開鍵。
// unpacked の ID をストア版に揃え、storage.sync のルールを共有するために使う。
// ストアはアップロードする manifest の key を受け付けないため、ストア用ビルドでは除く。
const storeKey =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAht2oK02E22blLslFOLRSdHtTbHfwZUC1ba2k08tGffbpoIoWZ2WcavL/xOUeROk8ymTONIAzQ+IqW5sZUMkx1q5zXC3s6wk1thQo8pOvhv8rVdSsb+NHS9trIMjqpLRNf1Z+TO+/DoRfRp3EPcfgFZ0++2eoBM4F0f3tHf1gob0wBIlIQPMhUIZrS6n1yFAeCe+nuoxdCF8+AzZ/Be33b+CiuZ8h3Y2+XqHFK0uf/aZKb1WaeuMCeRDxVlD3iahLLE/0uZnQU6fu0/GCitEe1WHeMP055OnkH//wTDe2DG3tQOHMlErorHuw0DyjRM1U68zCCgqkH2TQoPDJriLb/QIDAQAB";

export default defineConfig({
  imports: false,
  manifest: {
    name: "Tidy Title & URL",
    description: "__MSG_extDescription__",
    default_locale: "en",
    ...(process.env.STORE_BUILD ? {} : { key: storeKey }),
    permissions: ["contextMenus", "activeTab", "scripting", "storage"],
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
