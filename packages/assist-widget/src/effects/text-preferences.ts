import { ClassManager } from "./class-manager.js";
import { StyleManager } from "./style-manager.js";

const ROOT_EXCLUSION = ":not(#aa-assist-root):not(#aa-assist-root *)";
const ALIGNMENT_CLASSES = ["aa-assist-align-start", "aa-assist-align-center", "aa-assist-align-end"] as const;
const ALIGNABLE_DIV_EXCLUSION =
  ':not([style*="display:flex"]):not([style*="display: flex"]):not([style*="display:grid"]):not([style*="display: grid"])';

type Step = 0 | 1 | 2 | 3;

export const TEXT_ALIGNMENT_CSS = `
body.aa-assist-align-start p${ROOT_EXCLUSION},
body.aa-assist-align-start h1${ROOT_EXCLUSION},
body.aa-assist-align-start h2${ROOT_EXCLUSION},
body.aa-assist-align-start h3${ROOT_EXCLUSION},
body.aa-assist-align-start h4${ROOT_EXCLUSION},
body.aa-assist-align-start h5${ROOT_EXCLUSION},
body.aa-assist-align-start h6${ROOT_EXCLUSION},
body.aa-assist-align-start li${ROOT_EXCLUSION},
body.aa-assist-align-start span${ROOT_EXCLUSION},
body.aa-assist-align-start div${ROOT_EXCLUSION}${ALIGNABLE_DIV_EXCLUSION} { text-align: start !important; }

body.aa-assist-align-center p${ROOT_EXCLUSION},
body.aa-assist-align-center h1${ROOT_EXCLUSION},
body.aa-assist-align-center h2${ROOT_EXCLUSION},
body.aa-assist-align-center h3${ROOT_EXCLUSION},
body.aa-assist-align-center h4${ROOT_EXCLUSION},
body.aa-assist-align-center h5${ROOT_EXCLUSION},
body.aa-assist-align-center h6${ROOT_EXCLUSION},
body.aa-assist-align-center li${ROOT_EXCLUSION},
body.aa-assist-align-center span${ROOT_EXCLUSION},
body.aa-assist-align-center div${ROOT_EXCLUSION}${ALIGNABLE_DIV_EXCLUSION} { text-align: center !important; }

body.aa-assist-align-end p${ROOT_EXCLUSION},
body.aa-assist-align-end h1${ROOT_EXCLUSION},
body.aa-assist-align-end h2${ROOT_EXCLUSION},
body.aa-assist-align-end h3${ROOT_EXCLUSION},
body.aa-assist-align-end h4${ROOT_EXCLUSION},
body.aa-assist-align-end h5${ROOT_EXCLUSION},
body.aa-assist-align-end h6${ROOT_EXCLUSION},
body.aa-assist-align-end li${ROOT_EXCLUSION},
body.aa-assist-align-end span${ROOT_EXCLUSION},
body.aa-assist-align-end div${ROOT_EXCLUSION}${ALIGNABLE_DIV_EXCLUSION} { text-align: end !important; }
`;

export function applyLineHeight(styleManager: StyleManager, step: Step): void {
  if (step === 0) {
    styleManager.removeSection("line-height");
    return;
  }

  const lineHeight = { 1: 1.5, 2: 1.75, 3: 2 }[step];
  styleManager.setSection(
    "line-height",
    `
body p${ROOT_EXCLUSION},
body li${ROOT_EXCLUSION},
body span${ROOT_EXCLUSION},
body a${ROOT_EXCLUSION} { line-height: ${lineHeight} !important; }
body p${ROOT_EXCLUSION} { margin-bottom: ${1.5 * lineHeight}em !important; }
body h1${ROOT_EXCLUSION},
body h2${ROOT_EXCLUSION} { line-height: ${1.2 * lineHeight} !important; }
`
  );
}

export function applyTextSize(styleManager: StyleManager, step: Step): void {
  if (step === 0) {
    styleManager.removeSection("text-size");
    return;
  }

  const bodyMultiplier = { 1: 1.15, 2: 1.3, 3: 1.45 }[step];
  const headingMultiplier = { 1: 1.08, 2: 1.16, 3: 1.24 }[step];
  styleManager.setSection(
    "text-size",
    `
body p${ROOT_EXCLUSION},
body li${ROOT_EXCLUSION},
body span${ROOT_EXCLUSION},
body a${ROOT_EXCLUSION} { font-size: ${bodyMultiplier}em !important; }
body h1${ROOT_EXCLUSION},
body h2${ROOT_EXCLUSION} { font-size: ${headingMultiplier}em !important; }
`
  );
}

export function applyTextSpacing(styleManager: StyleManager, step: Step): void {
  if (step === 0) {
    styleManager.removeSection("text-spacing");
    return;
  }

  const values = {
    1: { letter: 0.12, word: 0.16, paragraph: 2 },
    2: { letter: 0.24, word: 0.32, paragraph: 2.5 },
    3: { letter: 0.36, word: 0.48, paragraph: 3 }
  }[step];

  styleManager.setSection(
    "text-spacing",
    `
body p${ROOT_EXCLUSION},
body li${ROOT_EXCLUSION},
body span${ROOT_EXCLUSION},
body a${ROOT_EXCLUSION},
body h1${ROOT_EXCLUSION},
body h2${ROOT_EXCLUSION} {
  letter-spacing: ${values.letter}em !important;
  word-spacing: ${values.word}em !important;
}
body p${ROOT_EXCLUSION} { margin-bottom: ${values.paragraph}em !important; }
`
  );
}

export function applyTextAlignment(classManager: ClassManager, step: Step): void {
  for (const className of ALIGNMENT_CLASSES) {
    classManager.removeBodyClass(className);
  }

  const className = ALIGNMENT_CLASSES[step - 1];
  if (className) {
    classManager.addBodyClass(className);
  }
}
