import preact from "@preact/preset-vite";
import { defineConfig } from "wxt";

export default defineConfig({
  imports: false,
  manifest: {
    name: "Copy Title and URL",
    default_locale: "en",
    // unpacked で読み込むパスに関係なく ID を固定し、storage.sync のルールを PC 間と更新後に引き継ぐため
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6sEkGeRyGJKwxH/1W1C2OnHpy5oyxon3jOLoGIUmNQspG/fABqNLM2IsAGFjlIV1lJxJAoFgl0f3EtRQHpOkw5frldYOT+/UL8+rMZ0eAyydaVmMQ9xnSs0lUKKDrFK3LcIIHaWf+COWW2tAP5oKnZ0el9fQE/RGX2qZUuf4vXJAUc295lThWmNnsRk6g6NpTRWPQZHRryoxRJZRg4K8SItQmjMEeAMLqhx0hHMQxVnHCTHS2Ab+6PP7fdzUWCcViMLGBLm9fQ7Ty4nkRTXydfHPYaSA7A7oPLb7ka6bVo3EnQnvX8XfGEQCqlKhqgukfeoXNirfDZr+qnzV+alpOQIDAQAB",
    permissions: ["contextMenus", "activeTab", "scripting", "storage"],
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
