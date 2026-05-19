import { describe, it, expect } from "bun:test";
import { evalFormula, formulaDepth, validateFormulaNode, parseAndValidateFormula } from "../src/db/queries/dashboard";

describe("formula evaluator", () => {
  it("sum with empty args returns 0", () => {
    const node = { op: "sum" as const, args: [] };
    const result = evalFormula(node, {});
    expect(result).toBe(0);
  });

  it("sum with all-null fields returns 0", () => {
    const node = {
      op: "sum" as const,
      args: [
        { op: "field" as const, name: "budget_amount" as const },
        { op: "field" as const, name: "actual_expense_amount" as const },
      ],
    };
    const result = evalFormula(node, { budget_amount: null, actual_expense_amount: null });
    expect(result).toBe(0);
  });

  it("divide by zero returns null", () => {
    const node = {
      op: "divide" as const,
      left: { op: "const" as const, value: 10 },
      right: { op: "const" as const, value: 0 },
    };
    const result = evalFormula(node, {});
    expect(result).toBeNull();
  });

  it("null propagation in add returns null", () => {
    const node = {
      op: "add" as const,
      left: { op: "field" as const, name: "budget_amount" as const },
      right: { op: "const" as const, value: 5 },
    };
    const result = evalFormula(node, { budget_amount: null });
    expect(result).toBeNull();
  });

  it("null propagation in multiply returns null", () => {
    const node = {
      op: "multiply" as const,
      left: { op: "field" as const, name: "revenue_amount" as const },
      right: { op: "const" as const, value: 2 },
    };
    const result = evalFormula(node, { revenue_amount: null });
    expect(result).toBeNull();
  });

  it("valid arithmetic computes correctly", () => {
    const node = {
      op: "subtract" as const,
      left: { op: "const" as const, value: 100 },
      right: { op: "const" as const, value: 30 },
    };
    const result = evalFormula(node, {});
    expect(result).toBe(70);
  });

  it("formulaDepth returns correct depth", () => {
    const shallow = { op: "const" as const, value: 1 };
    expect(formulaDepth(shallow)).toBe(1);

    const deep = {
      op: "add" as const,
      left: { op: "const" as const, value: 1 },
      right: {
        op: "multiply" as const,
        left: { op: "const" as const, value: 2 },
        right: { op: "const" as const, value: 3 },
      },
    };
    expect(formulaDepth(deep)).toBe(3);
  });

  it("validateFormulaNode accepts valid nodes", () => {
    expect(validateFormulaNode({ op: "field", name: "revenue_amount" })).toBe(true);
    expect(validateFormulaNode({ op: "const", value: 42 })).toBe(true);
    expect(validateFormulaNode({ op: "sum", args: [] })).toBe(true);
  });

  it("validateFormulaNode rejects invalid nodes", () => {
    expect(validateFormulaNode({ op: "field", name: "invalid" })).toBe(false);
    expect(validateFormulaNode({ op: "const", value: "not-a-number" })).toBe(false);
    expect(validateFormulaNode({ op: "pow", left: { op: "const", value: 2 }, right: { op: "const", value: 3 } })).toBe(false);
  });

  it("parseAndValidateFormula accepts empty/defaults", () => {
    expect(parseAndValidateFormula("{}").error).toBeNull();
    expect(parseAndValidateFormula("").error).toBeNull();
    expect(parseAndValidateFormula("  ").error).toBeNull();
  });

  it("parseAndValidateFormula rejects depth > 5", () => {
    const deep = {
      op: "add",
      left: { op: "const", value: 1 },
      right: {
        op: "add",
        left: { op: "const", value: 1 },
        right: {
          op: "add",
          left: { op: "const", value: 1 },
          right: {
            op: "add",
            left: { op: "const", value: 1 },
            right: {
              op: "add",
              left: { op: "const", value: 1 },
              right: { op: "const", value: 1 },
            },
          },
        },
      },
    };
    const result = parseAndValidateFormula(JSON.stringify(deep));
    expect(result.error).toBe("Formula depth exceeds 5");
  });
});
