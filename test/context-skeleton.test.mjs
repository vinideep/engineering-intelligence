import assert from "node:assert/strict";
import test from "node:test";
import { generateCodeSkeleton } from "../dist/context/skeleton.js";

test("generateCodeSkeleton extracts function signatures and folds body", () => {
  const code = `import { foo } from './foo.js';

export function add(a: number, b: number): number {
  const sum = a + b;
  console.log("sum calculated", sum);
  return sum;
}
`;
  const res = generateCodeSkeleton(code, "src/math.ts");
  assert.ok(res.skeleton.includes("import { foo } from './foo.js';"));
  assert.ok(res.skeleton.includes("export function add(a: number, b: number): number"));
  assert.ok(res.skeleton.includes("implementation omitted"));
  assert.ok(!res.skeleton.includes("console.log"));
  assert.ok(res.originalTokens > res.skeletonTokens);
  assert.ok(res.reductionRatio > 0);
});

test("generateCodeSkeleton preserves interfaces, types, and enums", () => {
  const code = `export interface User {
  id: string;
  name: string;
}

export type Role = "admin" | "user";

export enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}
`;
  const res = generateCodeSkeleton(code, "src/types.ts");
  assert.ok(res.skeleton.includes("interface User"));
  assert.ok(res.skeleton.includes("id: string;"));
  assert.ok(res.skeleton.includes("type Role"));
  assert.ok(res.skeleton.includes("enum Status"));
  assert.ok(res.skeleton.includes("Active = \"ACTIVE\""));
});

test("generateCodeSkeleton folds class methods and constructor while preserving members", () => {
  const code = `export class Greeter {
  private greeting: string;

  constructor(message: string) {
    this.greeting = message;
    console.log("initialized");
  }

  public greet(): string {
    return "Hello, " + this.greeting;
  }
}
`;
  const res = generateCodeSkeleton(code, "src/greeter.ts");
  assert.ok(res.skeleton.includes("class Greeter"));
  assert.ok(res.skeleton.includes("private greeting: string;"));
  assert.ok(res.skeleton.includes("constructor(message: string)"));
  assert.ok(res.skeleton.includes("public greet(): string"));
  assert.ok(!res.skeleton.includes("console.log(\"initialized\")"));
});

test("generateCodeSkeleton folds Python functions", () => {
  const code = `def calculate_total(price, tax):
    subtotal = price * 1.0
    total = subtotal + tax
    return total

class Calculator:
    def add(self, a, b):
        return a + b
`;
  const res = generateCodeSkeleton(code, "calc.py");
  assert.ok(res.skeleton.includes("def calculate_total(price, tax):"));
  assert.ok(res.skeleton.includes("# ... implementation omitted"));
  assert.ok(!res.skeleton.includes("subtotal = price * 1.0"));
  assert.ok(res.skeleton.includes("def add(self, a, b):"));
});

test("generateCodeSkeleton handles empty and single-line content", () => {
  const emptyRes = generateCodeSkeleton("", "empty.ts");
  assert.equal(emptyRes.originalTokens, 0);
  assert.equal(emptyRes.skeleton, "");

  const singleLine = "export const PI = 3.14159;";
  const res = generateCodeSkeleton(singleLine, "const.ts");
  assert.equal(res.skeleton, singleLine);
});
