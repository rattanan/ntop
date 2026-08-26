import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "app/(portal)/contracts/new/page.tsx"), "utf8");
const form = readFileSync(join(process.cwd(), "components/contract-create-form.tsx"), "utf8");
const action = readFileSync(join(process.cwd(), "app/(portal)/contracts/actions.ts"), "utf8");
const repository = readFileSync(join(process.cwd(), "lib/contract/prisma-contract-repository.ts"), "utf8");
const styles = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("Contract create form", () => {
  it("offers only accepted quote versions that do not already have a contract", () => {
    expect(page).toContain('status: "ACCEPTED"');
    expect(page).toContain("usedQuoteVersions");
    expect(page).toContain("acceptedQuotes.filter((quote) => !usedIds.has(quote.id))");
    expect(page).toContain("quotes.find((candidate) => candidate.id === selectedId)");
  });

  it("checks duplicate quote use again inside the contract transaction", () => {
    expect(repository).toContain("tx.contract.findUnique({ where: { quoteVersionId: id }");
    expect(repository).toContain("if (existingContract) return null");
  });

  it("keeps the form usable while the server action is pending or rejects input", () => {
    expect(form).toContain("useActionState(createContractAction, initialState)");
    expect(form).toContain("<FormNotice state={state} />");
    expect(form).toContain("disabled={pending || !types.length}");
    expect(action).toContain("error instanceof ZodError");
    expect(action).toContain('error.code === "P2002"');
    expect(action).toContain("unavailableQuoteState()");
    expect(action).toContain("!Number.isInteger(count) || count < 1 || count > 1000");
  });

  it("does not send Prisma values across the server-to-client boundary", () => {
    expect(page).toContain("quantity: item.quantity.toString()");
    expect(page).toContain("unitPrice: item.unitPrice.toString()");
    expect(page).toContain("discountAmount: item.discountAmount.toString()");
  });

  it("keeps the empty quotation message at the full panel width", () => {
    expect(page).toContain('className="card-body contract-quote-options"');
    expect(page).toContain('className="empty"');
    expect(styles).toContain(".contract-quote-options>.empty { width:100%;min-width:0;grid-column:1/-1");
    expect(styles).toContain("white-space:normal;overflow-wrap:anywhere");
  });
});
