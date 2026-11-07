import { runHook } from "site-fixture/diagnostics";
function internalFailure(): never { throw new Error("INTERNAL_STACK_SENTINEL"); }
await runHook(async () => internalFailure());
