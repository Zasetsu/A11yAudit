import { runFocusObscuredRule } from "./focus-obscured.js";
import { runFocusVisibleRule } from "./focus-visible.js";
import { runKeyboardTrapRule } from "./keyboard-trap.js";
import { runKeyboardUnreachableClickableRule } from "./keyboard-unreachable-clickable.js";
import type { InteractionRule, InteractionRuleFinding, InteractionRuleInput } from "./types.js";

export * from "./types.js";
export * from "./dom-utils.js";
export * from "./keyboard-unreachable-clickable.js";
export * from "./focus-obscured.js";
export * from "./focus-visible.js";
export * from "./keyboard-trap.js";

const interactionRules: InteractionRule[] = [
  runKeyboardUnreachableClickableRule,
  runFocusObscuredRule,
  runFocusVisibleRule,
  runKeyboardTrapRule
];

export async function runInteractionRules(input: InteractionRuleInput): Promise<InteractionRuleFinding[]> {
  const findings: InteractionRuleFinding[] = [];

  for (const rule of interactionRules) {
    try {
      findings.push(...(await rule(input)));
    } catch {
      // MVP page audits should continue if a custom interaction rule is brittle on a page.
    }
  }

  return findings;
}
