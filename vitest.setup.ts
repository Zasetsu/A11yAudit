// Mark the test runtime as a React act() environment before any test module
// imports React, so React Testing utilities don't emit
// "The current testing environment is not configured to support act(...)"
// warnings. Harmless for non-React (node-environment) test files.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
