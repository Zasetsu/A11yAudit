import { getFocusedElementSnapshot, resetFocus, type FocusedElementSnapshot } from "./dom-utils.js";
import type { InteractionRule, InteractionRuleFinding } from "./types.js";

const ruleId = "keyboard-trap-suspected";
const title = "Potential keyboard trap detected";
const maxTabPresses = 24;
const minimumSequenceLength = 12;
const maximumUniqueSelectors = 3;

export const runKeyboardTrapRule: InteractionRule = async ({ page }) => {
  await resetFocus(page);

  const sequence: FocusedElementSnapshot[] = [];

  for (let index = 0; index < maxTabPresses; index += 1) {
    await page.keyboard.press("Tab");

    const snapshot = await getFocusedElementSnapshot(page);
    if (snapshot === null) break;

    sequence.push(snapshot);
  }

  const focusedSelectors = sequence.map((snapshot) => snapshot.selector).filter(isPresent);
  const repeatedSelectors = new Set(focusedSelectors);

  if (focusedSelectors.length < minimumSequenceLength || repeatedSelectors.size > maximumUniqueSelectors) {
    return [];
  }

  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");

  const escapedSnapshot = await getFocusedElementSnapshot(page);
  const escapedSelector = escapedSnapshot?.selector ?? null;
  if (escapedSelector !== null && !repeatedSelectors.has(escapedSelector)) {
    return [];
  }

  const representative = sequence.find((snapshot) => snapshot.selector !== null) ?? sequence[0];
  return representative === undefined ? [] : [createFinding(representative)];
};

export const keyboardTrapRule = runKeyboardTrapRule;

function createFinding(snapshot: FocusedElementSnapshot): InteractionRuleFinding {
  return {
    ruleId,
    title,
    severity: "critical",
    certainty: "needs_manual_verification",
    wcagCriteria: ["2.1.2"],
    description: "Sequential keyboard navigation appears to repeat within a small set of focused elements.",
    recommendation: "Ensure keyboard users can move focus away from all components, or provide a documented Escape behavior that releases focus.",
    selector: snapshot.selector,
    htmlSnippet: snapshot.htmlSnippet,
    visibleText: snapshot.visibleText
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
