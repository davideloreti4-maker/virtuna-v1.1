// The suite's stand-in for `server-only`, which Next resolves itself (an empty module on the server, an error in a
// client bundle) and which is not installed as a package: vitest.config.ts points the import here.
export {};
