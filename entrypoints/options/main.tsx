import { render } from "preact";
import { setDocumentLanguage, t } from "../../lib/i18n";
import { App } from "./App";

setDocumentLanguage();
document.title = t("optionsTitle");
render(<App />, document.getElementById("app")!);
