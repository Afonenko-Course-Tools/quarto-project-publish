import { ppid } from "node:process";
console.log(
  JSON.stringify([
    Deno.env.get("COURSE_PERF_PARENT_SPAN_ID") ?? null,
    Deno.env.get("FUNCTIONAL"),
    Deno.env.get("FUNCTIONAL_INHERITED"),
    Deno.env.get("QUARTO_PROFILE"),
    ppid,
  ]),
);
