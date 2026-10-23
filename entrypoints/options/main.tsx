import { render } from "preact";
import { browser } from "wxt/browser";
import { App } from "./App";

document.documentElement.lang = browser.i18n.getUILanguage();
document.title = browser.i18n.getMessage("optionsTitle");
render(<App />, document.getElementById("app")!);
