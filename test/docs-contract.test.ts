import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { checkUsage, parseCli } from "../src/cli-args.ts";
import { harnesses } from "../src/core.ts";
import { publicDeskPacks } from "../src/desk-launch.ts";
import { HERMES_COMMIT, HERMES_VERSION } from "../src/hermes.ts";
import { aixbtConfig, blockscoutConfig, coinbaseSettings, providers as connections } from "../src/onboarding.ts";
import { providerCatalog } from "../src/provider-catalog.ts";
import { templates } from "../src/templates.ts";
import { workflows } from "../src/workflows.ts";
import skillCatalog from "../catalog/skills.json";
import packageFile from "../package.json";

// The text Boomkin ships or publishes: the npm package's guides, the website copy, and the
// strings the CLI prints or writes into a profile. CHANGELOG.md is history and is not checked.
const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const markdown = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "SECURITY.md", "ATTRIBUTION.md", ...readdirSync(join(root, "docs")).filter(name => name.endsWith(".md")).map(name => `docs/${name}`)];
const siteCopy = [...readdirSync(join(root, "site/docs")).map(name => `site/docs/${name}`), "site/index.html", "site/lab/index.html", "site/assets/app.js", "site/assets/onboarding.js"];
const printed = ["src/cli.ts", "src/core.ts", "src/onboarding.ts", "src/workflows.ts", "src/templates.ts", "src/projects.ts", "scripts/workflow-docs.ts"];
const prose = [...markdown, "llms.txt", ...siteCopy];
const everything = [...prose, ...printed];
const lines = (paths: string[]) => paths.flatMap(path => read(path).split("\n").map((text, index) => ({ at: `${path}:${index + 1}`, path, text })));

const packs = skillCatalog.packs;
const skills = new Set(packs.flatMap(pack => pack.skills));
const ids = {
  workflow: new Set(workflows.map(item => item.id)),
  template: new Set(templates.map(item => item.id)),
  provider: new Set([...providerCatalog.providers.map(item => item.id), ...Object.keys(connections), "coinbase"]),
  pack: new Set(packs.map(pack => pack.id)),
  harness: new Set(Object.keys(harnesses)),
  action: new Set(["login", "status", "refresh", "model"]),
  access: new Set(["keyless", "credentials", "mixed", "local", "unknown"]),
};
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const number = (text: string) => /^\d+$/.test(text) ? Number(text) : words.indexOf(text.toLowerCase());
const N = `(\\d+|${words.join("|")})`;

test("every boomkin command in shipped text is accepted by the CLI's own argument rules", () => {
  let checked = 0;
  const failures: string[] = [];
  for (const { at, text } of lines(everything)) {
    for (const match of text.matchAll(/(?:^|[`>\s(])boomkin ([a-z]+(?: (?:[^`<|]|<[a-z-]+>)*)?)/g)) {
      const example = match[1]!.replace(/\\$/, "").replace(/\$\{[^}]*\}/g, "placeholder").trim();
      const args = (example.match(/"[^"]*"|\S+/g) ?? []).map(part => part.replace(/^"|"$/g, "").replace(/[.,;:)]+$/, ""));
      // Prose such as "boomkin installs" is not a command; a known command word or any flag makes it one.
      const flagged = args.findIndex(arg => arg.startsWith("--"));
      let known = true;
      try { checkUsage(parseCli([args[0]!]).values, [args[0]!]); } catch (error) { known = !String(error).includes("Unknown command"); }
      if (!known && flagged < 0) continue;
      // Sentences continue after an inline command; keep the command, its subcommand and its flags.
      const end = flagged < 0 ? (args[0] === "project" ? 2 : 1) : args.length;
      const kept = args.slice(0, end).filter((arg, index, all) => index < (args[0] === "project" ? 2 : 1) || arg.startsWith("--") || all[index - 1]?.startsWith("--"));
      try {
        const { values, positionals } = parseCli(kept);
        checkUsage(values, positionals);
        for (const [kind, known] of Object.entries(ids)) {
          const supplied = values[kind as keyof typeof values];
          for (const value of Array.isArray(supplied) ? supplied : typeof supplied === "string" ? [supplied] : []) {
            if (!known.has(value) && !/^[<[]|placeholder/.test(value)) throw new Error(`unknown ${kind} ${value}`);
          }
        }
        checked++;
      } catch (error) { failures.push(`${at}: boomkin ${kept.join(" ")} -> ${(error as Error).message}`); }
    }
  }
  expect(failures).toEqual([]);
  expect(checked).toBeGreaterThan(100);
});

test("inventory counts in shipped text equal the catalogues and code they describe", () => {
  const claims: [RegExp, number][] = [
    [new RegExp(`\\b${N} (?:workflows\\b|workflow IDs|jobs with actual)`, "gi"), workflows.length],
    [new RegExp(`\\b${N} (?:providers in discovery|discovery entries|source-reviewed entries)`, "gi"), providerCatalog.providers.length],
    [new RegExp(`\\bretains ${N} reviewed entries`, "gi"), providerCatalog.providers.filter(provider => provider.listedInDirectory).length],
    [new RegExp(`\\b${N} (?:independent packs|independently (?:published|selected) packs|packs\\b)`, "gi"), packs.length],
    [new RegExp(`\\b${N} (?:reviewed skills|expected skill IDs|skills\\.)`, "gi"), skills.size],
    [new RegExp(`\\b${N} reviewed (?:templates|starting points)`, "gi"), templates.length],
    [new RegExp(`\\b${N} reviewed (?:skill )?packs\\b`, "gi"), publicDeskPacks.length],
    [new RegExp(`\\b${N} connection IDs`, "gi"), Object.keys(connections).length + 1],
    [new RegExp(`\\b${N} named read`, "gi"), blockscoutConfig.tools.include.length],
    [new RegExp(`\\b${N} read tools discovered`, "gi"), aixbtConfig.tools.include.length],
  ];
  const failures: string[] = [];
  for (const [pattern, expected] of claims) {
    let seen = 0;
    for (const { at, text } of lines(prose)) {
      for (const match of text.matchAll(pattern)) {
        seen++;
        if (number(match[1]!) !== expected) failures.push(`${at}: "${match[0]}" should say ${expected}`);
      }
    }
    // A reworded claim must be re-matched here rather than silently dropped from the check.
    if (!seen) failures.push(`no shipped text matches ${pattern}`);
  }
  expect(failures).toEqual([]);
});

test("versions and commits named in shipped text are the ones the code pins", () => {
  const failures: string[] = [];
  const expectAll = (pattern: RegExp, expected: string, paths = prose, required = true) => {
    let seen = 0;
    for (const { at, text } of lines(paths)) {
      for (const match of text.matchAll(pattern)) {
        seen++;
        if (match[1] !== expected) failures.push(`${at}: "${match[0]}" should be ${expected}`);
      }
    }
    if (required && !seen) failures.push(`no shipped text matches ${pattern}`);
  };
  expectAll(/\bboomkin@(\d+\.\d+\.\d+)/g, packageFile.version);
  expectAll(/\bskills@(\d+\.\d+\.\d+)/g, packageFile.dependencies.skills);
  expectAll(/coinbase-cli@(\d+\.\d+\.\d+)/g, coinbaseSettings("/profile").args[1]!.split("@").at(-1)!, [...prose, "src/onboarding.ts"]);
  const bun = packageFile.packageManager.replace("bun@", "");
  expect(packageFile.engines.bun).toBe(`>=${bun}`);
  expectAll(/\bBun(?:\]\([^)]*\))? (\d+\.\d+\.\d+)/g, bun);
  for (const name of readdirSync(join(root, ".github/workflows"))) {
    for (const job of Object.values((parseYaml(read(`.github/workflows/${name}`)) as { jobs: Record<string, { steps?: { with?: Record<string, unknown> }[] }> }).jobs)) {
      for (const step of job.steps ?? []) if (step.with?.["bun-version"] !== undefined && step.with["bun-version"] !== bun) failures.push(`${name}: bun-version ${step.with["bun-version"]} should be ${bun}`);
    }
  }
  // Hermes: the reviewed release, plus the oldest release an existing installation may have.
  const minimum = "0.21.0";
  expect(read("src/hermes.ts")).toContain(`Boomkin requires Hermes ${minimum} or newer`);
  let hermes = 0;
  for (const { at, text } of lines(prose)) {
    if (!/Hermes/.test(text)) continue;
    for (const match of text.matchAll(/(?<![\w.@/-])v?(\d+\.\d+\.\d+)(?![\w/-])/g)) {
      if (/boomkin@|skills@|coinbase-cli@|Bun/.test(text.slice(Math.max(0, match.index - 40), match.index))) continue;
      hermes++;
      if (match[1] !== HERMES_VERSION && match[1] !== minimum) failures.push(`${at}: Hermes ${match[1]} should be ${HERMES_VERSION}`);
    }
  }
  if (!hermes) failures.push("no shipped text names the reviewed Hermes release");
  // WORKFLOWS.md is generated from the catalogue and has its own exact-match check.
  const pins = new Set([HERMES_COMMIT, ...packs.map(pack => pack.revision), JSON.parse(read("site/vendor/provenance.json")).revision]);
  for (const { at, text } of lines(prose.filter(path => path !== "docs/WORKFLOWS.md"))) {
    for (const match of text.matchAll(/\b[0-9a-f]{40}\b/g)) if (!pins.has(match[0])) failures.push(`${at}: commit ${match[0]} is not a pin in this repository`);
  }
  expect(failures).toEqual([]);
});

test("skills, scripts, files, links and anchors named in shipped text exist", () => {
  const failures: string[] = [];
  const slug = (heading: string) => heading.toLowerCase().replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/ /g, "-");
  const anchors = (path: string) => {
    const found = new Set<string>();
    let fenced = false;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.startsWith("```")) fenced = !fenced;
      if (fenced) continue;
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      if (heading) found.add(slug(heading[1]!));
      for (const id of line.matchAll(/id="([^"]+)"/g)) found.add(id[1]!);
    }
    return found;
  };
  for (const { at, path, text } of lines(everything)) {
    for (const match of text.matchAll(/\bgalleon-[a-z0-9]+(?:-[a-z0-9]+)*/g)) {
      const name = match[0];
      const partial = /[*$`{]/.test(text[match.index + name.length] ?? "") && !skills.has(name);
      if (!skills.has(name) && !ids.pack.has(name.replace(/^galleon-/, "")) && !partial) failures.push(`${at}: ${name} is not a catalogue skill or package`);
    }
    for (const match of text.matchAll(/skills\/([a-z0-9-]+)\/(?:scripts|references)\//g)) if (!skills.has(match[1]!)) failures.push(`${at}: ${match[1]} is not a catalogue skill`);
    for (const match of text.matchAll(/\bbun run ([a-z][a-z:-]*)/g)) if (!(match[1]! in packageFile.scripts)) failures.push(`${at}: bun run ${match[1]} is not a package script`);
    for (const match of text.matchAll(/`((?:src|scripts|docs|catalog|site|test|desk|\.github)\/[A-Za-z0-9_./-]+)`/g)) if (!existsSync(join(root, match[1]!))) failures.push(`${at}: ${match[1]} does not exist`);
    for (const match of text.matchAll(/\bbun (scripts\/[a-z-]+\.ts)/g)) if (!existsSync(join(root, match[1]!))) failures.push(`${at}: ${match[1]} does not exist`);
    for (const match of text.matchAll(/github\.com\/galleonlabs\/boomkin\/blob\/main\/([^\s)#"]+)/g)) if (!existsSync(join(root, match[1]!))) failures.push(`${at}: ${match[1]} does not exist`);
    if (!markdown.includes(path)) continue;
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const [file, anchor] = match[1]!.split("#");
      if (/^(?:https?:|mailto:)/.test(match[1]!)) continue;
      const target = file ? resolve(root, dirname(path), file) : join(root, path);
      if (!existsSync(target)) failures.push(`${at}: ${match[1]} does not exist`);
      else if (anchor !== undefined && target.endsWith(".md") && !anchors(target).has(anchor)) failures.push(`${at}: ${match[1]} has no such heading`);
    }
  }
  expect(failures).toEqual([]);
});
