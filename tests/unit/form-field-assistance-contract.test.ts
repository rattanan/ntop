import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assistance = readFileSync("components/form-field-assistance.tsx", "utf8");
const portalLayout = readFileSync("app/(portal)/layout.tsx", "utf8");
const presalesForms = readFileSync("components/presales-forms.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("global form-field assistance contract", () => {
  it("mounts once for every authenticated portal page", () => {
    expect(portalLayout).toContain("<FormFieldAssistance />");
  });

  it("keeps help inside the label-text span before wrapped form controls", () => {
    expect(presalesForms).toContain('<label className="field"><span>{label}</span><input');
    expect(assistance).toContain("function placeHelpAfterLabelText");
    expect(assistance).toContain("helpAnchorForLabel(label, labelText).append(help)");
    expect(assistance).toContain('existing.dataset.fieldLabelContent = "true"');
    expect(assistance).not.toContain("label.append(helpElement");
  });

  it("repairs previously misplaced help and renders the label group inline", () => {
    expect(assistance).toContain(":scope > .field-help[data-field-help='true']");
    expect(assistance).toContain("placeHelpAfterLabelText(label, labelText, misplacedHelp)");
    expect(css).toContain(".field-label-content { width:max-content;max-width:100%;min-width:0;display:inline-flex;align-items:center");
  });
});
