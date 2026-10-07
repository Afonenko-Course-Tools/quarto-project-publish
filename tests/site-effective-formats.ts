import { assert, assertEquals, assertRejects } from "./support.ts";
const root = await Deno.makeTempDir({ prefix: "course-site-effective-" });
try {
  await Deno.writeTextFile(
    `${root}/_quarto.yml`,
    "project:\n  type: website\n  output-dir: _site\nformat: html\n",
  );
  await Deno.writeTextFile(`${root}/index.qmd`, "# HTML\n");
  await Deno.writeTextFile(
    `${root}/slides.qmd`,
    "---\nformat: revealjs\n---\n# Slides\n",
  );
  await Deno.writeTextFile(`${root}/_quarto-full.yml`, "format: revealjs\n");
  const api: any = await import(
    "../_extensions/course-site/infrastructure/config.ts"
  );
  assert(
    api.inspectDocuments,
    "effective native document format inspection is missing",
  );
  const plan = await api.inspectDocuments(root, []);
  assertEquals(
    plan.documents.find((d: any) => d.source.endsWith("index.qmd")).format,
    "html",
  );
  assertEquals(
    plan.documents.find((d: any) => d.source.endsWith("slides.qmd")).format,
    "revealjs",
  );
  assertEquals(plan.renderTo, undefined);
  const full = await api.inspectDocuments(root, ["full"]);
  assert(
    full.documents.every((d: any) => d.format === "revealjs"),
    "profile override was ignored",
  );
  await Deno.writeTextFile(
    `${root}/index.qmd`,
    "---\nformat:\n  html: default\n  pdf: default\n---\n# Web plus print\n",
  );
  const both = await api.inspectDocuments(root, []);
  assertEquals(
    both.documents.find((d: any) => d.source.endsWith("index.qmd")).format,
    "html",
  );
  assertEquals(both.renderTo, "default");
  await Deno.writeTextFile(
    `${root}/index.qmd`,
    "---\nformat:\n  pdf: default\n  html: default\n---\n# Print first\n",
  );
  const printFirst = await api.inspectDocuments(root, []);
  assertEquals(printFirst.renderTo, null);
  await Deno.mkdir(`${root}/_extensions/custom`, { recursive: true });
  await Deno.writeTextFile(
    `${root}/_extensions/custom/_extension.yml`,
    "title: Custom\nversion: 0.1.0\ncontributes:\n  formats:\n    html:\n      toc: true\n",
  );
  await Deno.writeTextFile(
    `${root}/index.qmd`,
    "---\nformat: custom-html\n---\n# Custom\n",
  );
  const custom = await api.inspectDocuments(root, []);
  const customDoc = custom.documents.find((d: any) => d.source === "index.qmd");
  assertEquals([customDoc.format, customDoc.baseFormat, customDoc.web], [
    "custom-html",
    "html",
    true,
  ]);
  await Deno.writeTextFile(
    `${root}/index.qmd`,
    "---\nformat:\n  html: default\n  revealjs: default\n---\n# Ambiguous\n",
  );
  await assertRejects(() => api.inspectDocuments(root, []), "SITE.FORMAT_AMBIGUOUS", [root, "index.qmd", "format"]);
  console.log(
    "PASS effective per-document formats, profiles, HTML+PDF and web ambiguity",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
