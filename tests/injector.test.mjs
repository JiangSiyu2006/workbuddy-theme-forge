import test from "node:test";
import assert from "node:assert/strict";
import { inject } from "../src/injector.mjs";
import { defaultTheme } from "../src/theme-schema.mjs";
test("inject expression is idempotent", async () => { let expression=""; const session={evaluate:async(value)=>{expression=value;return {}}}; await inject(session,{manifest:defaultTheme()}); assert.match(expression,/wb-theme-forge-style/); assert.equal((expression.match(/createElement/g)||[]).length,1); });
