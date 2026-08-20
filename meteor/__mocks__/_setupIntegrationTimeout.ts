/**
 * Raise the default test timeout for the integration project.
 *
 * This cannot be done with `testTimeout` in the project config: jest reads that from the *global*
 * config only, so a value set on a project inside `projects: [...]` is silently ignored and the tests
 * run with jest's 5s default. Calling `jest.setTimeout` from `setupFilesAfterEnv` runs inside the test
 * environment and does apply, and keeps the faster default for the unit project.
 *
 * These tests wait on real change-stream / replica-set I/O, which can take many seconds on a loaded
 * machine. The polling helpers (see `waitFor`) use a lower ceiling so that they, rather than jest,
 * report a genuine hang - with a message that says what was being waited for.
 */
jest.setTimeout(30000)
