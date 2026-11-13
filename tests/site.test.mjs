// Stage 1 · Test. Fast checks that the site is whole before anything is built.
// Zero dependencies: runs with Node's built-in test runner.
//
//   node --test tests/site.test.mjs

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("every JSON file the site publishes is valid JSON", () => {
  const files = [
    ...readdirSync(join(root, "api")).map((name) => `api/${name}`),
    ...readdirSync(join(root, ".well-known")).map((name) => `.well-known/${name}`),
  ].filter((path) => path.endsWith(".json"));

  assert.ok(files.length > 0, "no JSON files found");
  for (const path of files) {
    assert.doesNotThrow(() => JSON.parse(read(path)), `${path} is not valid JSON`);
  }
});

test("every endpoint listed in api/index.json exists", () => {
  const index = JSON.parse(read("api/index.json"));
  for (const { path } of index.endpoints) {
    assert.ok(existsSync(join(root, path)), `${path} is listed but missing`);
  }
});

test("every local file index.html points at exists", () => {
  const html = read("index.html");
  const references = [...html.matchAll(/\b(?:href|src)="([^"#?]+)[^"]*"/g)]
    .map((match) => match[1])
    .filter((ref) => !/^(?:[a-z]+:|\/\/)/i.test(ref) && ref !== "/");

  assert.ok(references.length > 0, "found no local references in index.html");
  for (const ref of new Set(references)) {
    assert.ok(existsSync(join(root, ref)), `index.html points at ${ref}, which is missing`);
  }
});

test("the build and server scripts parse", () => {
  for (const script of ["build.mjs", "server.mjs"]) {
    execFileSync(process.execPath, ["--check", join(root, script)]);
  }
});

test("the image (nginx) sends every header that Cloudflare (_headers) sends", () => {
  const nginx = read("nginx/site.conf");
  const rules = read("_headers")
    .split("\n")
    .filter((line) => /^\s+\S/.test(line) && !line.trim().startsWith("#"))
    .map((line) => line.trim().match(/^([^:]+):\s*(.+)$/));

  assert.ok(rules.length > 0, "found no header rules in _headers");
  for (const [, name, value] of rules) {
    assert.ok(
      nginx.includes(`add_header ${name} "${value}"`),
      `_headers sends "${name}: ${value}" but nginx/site.conf does not`,
    );
  }
});
