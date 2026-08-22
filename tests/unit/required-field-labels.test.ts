import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { FormField, Input } from "../../components/form-field";

const root = process.cwd();
const styles = readFileSync(join(root, "app/globals.css"), "utf8");

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("required field labels", () => {
  it("renders one red, accessible required marker from the shared FormField", () => {
    const html = renderToStaticMarkup(FormField({
      label: "ชื่อ",
      name: "name",
      required: true,
      children: createElement(Input, { name: "name", required: true }),
    }));

    expect(html.match(/class="required"/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true">*</span>');
    expect(html).toContain('<span class="sr-only"> (จำเป็น)</span>');
  });

  it("adds a red star to legacy field labels without duplicating FormField markers", () => {
    expect(styles).toContain(".field:has(:required)>span:first-child::after");
    expect(styles).toContain(".field:has(:required)>label:first-child:not(:has(.required))::after");
    expect(styles).toContain("label:has(>:required)>span:first-child::after");
    expect(styles).toContain("color:var(--destructive)");
  });

  it("marks Prospect schema-required fields as required in the rendered form", () => {
    const prospectForm = readFileSync(join(root, "components/prospect-form.tsx"), "utf8");
    expect(prospectForm).toContain('field("companyName", "ชื่อบริษัท/หน่วยงาน", "text", true)');
    expect(prospectForm).toContain("required={required}");
    expect(prospectForm).toContain('<select className="control" required {...register("source")}');
    expect(prospectForm).toContain('<select className="control" required {...register("status")}');
  });

  it("keeps every native required control associated with a marked label or required table heading", () => {
    const uncovered: string[] = [];

    for (const file of [...tsxFiles(join(root, "components")), ...tsxFiles(join(root, "app"))]) {
      const sourceText = readFileSync(file, "utf8");
      const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const tagName = (node: ts.JsxElement | ts.JsxSelfClosingElement) => ts.isJsxElement(node) ? node.openingElement.tagName.getText(source) : node.tagName.getText(source);
      const attributes = (node: ts.JsxElement | ts.JsxSelfClosingElement) => ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
      const attribute = (node: ts.JsxElement | ts.JsxSelfClosingElement, name: string) => attributes(node).properties.find((item) => ts.isJsxAttribute(item) && item.name.getText(source) === name) as ts.JsxAttribute | undefined;
      const labelsByFor = new Set<string>();

      const collectLabels = (node: ts.Node) => {
        if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && tagName(node) === "label") {
          const htmlFor = attribute(node, "htmlFor")?.initializer?.getText(source);
          const marked = sourceText.slice(node.getStart(source), node.getEnd()).includes("required");
          if (htmlFor && marked) labelsByFor.add(htmlFor);
        }
        ts.forEachChild(node, collectLabels);
      };
      collectLabels(source);

      const inspect = (node: ts.Node) => {
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = tagName(node);
          if (["input", "select", "textarea"].includes(tag) && attribute(node, "required")) {
            let parent: ts.Node | undefined = node.parent;
            let covered = false;
            while (parent) {
              if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) {
                const parentTag = tagName(parent);
                const parentMarkup = sourceText.slice(parent.getStart(source), parent.getEnd());
                if (parentTag === "FormField" && attribute(parent, "required")) covered = true;
                if (parentTag === "label" && (parentMarkup.includes("<span") || parentMarkup.includes("required-label"))) covered = true;
                if (parentTag === "td") covered = true;
              }
              parent = parent.parent;
            }
            const id = attribute(node, "id")?.initializer?.getText(source);
            if (id && labelsByFor.has(id)) covered = true;
            if (!covered) {
              const position = source.getLineAndCharacterOfPosition(node.getStart(source));
              uncovered.push(`${file.slice(root.length + 1)}:${position.line + 1}`);
            }
          }
        }
        ts.forEachChild(node, inspect);
      };
      inspect(source);
    }

    expect(uncovered).toEqual([]);
    expect(readFileSync(join(root, "components/contract-create-form.tsx"), "utf8")).toContain('<span className="required-label">Service</span>');
    expect(readFileSync(join(root, "components/workflow-forms.tsx"), "utf8")).toContain('<span className="required-label">Product / Service</span>');
  });
});
