import { describe, expect, test } from "bun:test";
import { compareValue, countVerdicts, mean, normalizeText } from "../src/grading";

describe("normalizeText", () => {
  test("ignores case, extra spaces and honorific prefixes", () => {
    expect(normalizeText("  Dr.  Tran   Van Long ")).toBe(normalizeText("Tran Van Long"));
    expect(normalizeText("BS. Nguyen An")).toBe("nguyen an");
  });

  test("does not strip an honorific that is part of a longer word", () => {
    expect(normalizeText("Drake Pharmacy")).toBe("drake pharmacy");
  });
});

describe("compareValue", () => {
  test("matching scalars are correct, numbers compare by value", () => {
    expect(compareValue("Sunrise Medical Center", "sunrise medical center")[0]?.verdict).toBe("correct");
    expect(compareValue(1050000, "1050000")[0]?.verdict).toBe("correct");
  });

  test("different values are wrong", () => {
    expect(compareValue(430, 439)[0]?.verdict).toBe("wrong");
  });

  test("null expected with a value returned is hallucinated", () => {
    expect(compareValue(null, "Cash")[0]?.verdict).toBe("hallucinated");
  });

  test("null expected with null or empty actual is correct", () => {
    expect(compareValue(null, null)[0]?.verdict).toBe("correct");
    expect(compareValue(null, "  ")[0]?.verdict).toBe("correct");
    expect(compareValue([], [])[0]?.verdict).toBe("correct");
  });

  test("expected value with null actual is missing", () => {
    expect(compareValue("Cash", null)[0]?.verdict).toBe("missing");
  });

  test("arrays compare by index and extra rows are hallucinated", () => {
    const leaves = compareValue(["a", "b"], ["a", "b", "c"], "procedures");
    expect(leaves.map((l) => l.verdict)).toEqual(["correct", "correct", "hallucinated"]);
    expect(leaves[2]?.path).toBe("procedures[extra]");
  });

  test("missing array rows are reported as missing", () => {
    const leaves = compareValue(["a", "b"], ["a"], "procedures");
    expect(leaves.map((l) => l.verdict)).toEqual(["correct", "missing"]);
  });

  test("objects recurse into keys with dotted paths", () => {
    const leaves = compareValue({ primary: "Appendicitis", secondary: null }, { primary: "appendicitis", secondary: "x" }, "diagnosis");
    expect(leaves.map((l) => [l.path, l.verdict])).toEqual([
      ["diagnosis.primary", "correct"],
      ["diagnosis.secondary", "hallucinated"],
    ]);
  });

  test("a non-object actual counts every nested key as missing", () => {
    const leaves = compareValue({ name: "A", unit: "mg" }, null, "test");
    expect(leaves.map((l) => l.verdict)).toEqual(["missing", "missing"]);
  });
});

test("countVerdicts tallies every verdict", () => {
  const counts = countVerdicts(compareValue(["a", null, "x"], ["a", "y", "z"]));
  expect(counts).toEqual({ correct: 1, wrong: 1, hallucinated: 1, missing: 0 });
  expect(countVerdicts([])).toEqual({ correct: 0, wrong: 0, hallucinated: 0, missing: 0 });
});

describe("mean", () => {
  test("rounds to 3 decimals and returns null for empty input", () => {
    expect(mean([0.9, 0.95, 0.97])).toBe(0.94);
    expect(mean([])).toBeNull();
  });
});
