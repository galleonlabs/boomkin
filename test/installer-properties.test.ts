import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { catalogChanges, installedVersion, parseCatalog, parseConfig, selectPacks, type Catalog, type Pack } from "../src/core.ts";
import { skillFiles, verifyCopiedSkill, verifyIntegrity, type SkillIntegrity } from "../src/integrity.ts";
import catalogFile from "../catalog/skills.json";

// Seeded generator (mulberry32): a failing case reproduces from its printed seed.
function seeded(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (max: number) => Math.floor(next() * max);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!;
  return { next, int, pick };
}
const real = () => structuredClone(catalogFile) as unknown as Catalog;
const reviewed = parseCatalog(real());

// One hostile value per pinned field. Each must be refused wherever it lands.
const hostile: Record<keyof Pack, (pack: Pack, other: Pack) => unknown[]> = {
  id: (pack, other) => [other.id, pack.id.toUpperCase(), `${pack.id}/..`, `../${pack.id}`, pack.id.replace(/-skills$/, ""), "", 7, null],
  source: () => ["galleonlabs/other-skills", "attacker/crypto-defi-skills", "https://github.com/galleonlabs/crypto-defi-skills", "galleonlabs/crypto-defi-skills/../x", "", null],
  path: (pack, other) => [other.path, `${pack.path}/../../outside`, `/${pack.path}`, `${pack.path}/`, "packages/..", "packages/.", `./${pack.path}`, pack.path.replace("packages/", "packages\\"), "", null],
  package: (pack, other) => [other.package, pack.id, `@galleon/${pack.id}`, "", null],
  version: pack => [`v${pack.version}`, `${pack.version}-rc.1`, "1.2", "latest", "*", `^${pack.version}`, "", 1, null],
  revision: pack => [pack.revision.slice(0, 39), pack.revision.slice(0, 7), pack.revision.toUpperCase().replace(/[0-9]/g, "A"), `${pack.revision}0`, "main", "HEAD", "", null],
  skills: (pack, other) => [[], [other.skills[0]], [...pack.skills, pack.skills[0]], [`../${pack.skills[0]}`], [`${pack.skills[0]}/scripts`], [pack.skills[0]!.toUpperCase()], ["unreviewed-skill"], [7], "all", null],
  description: () => [7, null, undefined],
};

test("a catalogue with any one hostile pin, path or skill name never parses", () => {
  const fields = Object.keys(hostile) as (keyof Pack)[];
  for (let seed = 1; seed <= 400; seed++) {
    const random = seeded(seed);
    const catalog = real();
    const index = random.int(catalog.packs.length);
    const pack = catalog.packs[index]!;
    const other = catalog.packs[(index + 1 + random.int(catalog.packs.length - 1)) % catalog.packs.length]!;
    const field = random.pick(fields);
    const value = random.pick(hostile[field](pack, other));
    (pack as Record<string, unknown>)[field] = value;
    expect(() => parseCatalog(catalog), `seed ${seed}: ${field} = ${JSON.stringify(value)}`).toThrow();
  }
  for (const value of [null, [], "catalog", { schemaVersion: 3 }, { schemaVersion: 3, packs: [] }, { ...real(), schemaVersion: 2 }, { ...real(), schemaVersion: "3" }]) {
    expect(() => parseCatalog(value)).toThrow();
  }
});

test("every accepted pack stays inside the reviewed monorepo with full pins", () => {
  for (const pack of reviewed.packs) {
    expect(pack.source).toBe("galleonlabs/crypto-defi-skills");
    expect(pack.path.split("/")).toEqual(["packages", expect.stringMatching(/^[a-z0-9-]+$/)]);
    expect(pack.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const skill of pack.skills) expect(skill).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("pack selection is idempotent, exact and keeps catalogue order; hostile selections are refused", () => {
  const ids = reviewed.packs.map(pack => pack.id);
  for (let seed = 1; seed <= 300; seed++) {
    const random = seeded(seed);
    const wanted = ids.filter(() => random.next() < 0.4);
    if (!wanted.length) wanted.push(random.pick(ids));
    const shuffled = [...wanted].sort(() => random.next() - 0.5);
    const selected = selectPacks(reviewed, shuffled);
    expect(selected.packs.map(pack => pack.id), `seed ${seed}`).toEqual(wanted);
    expect(selectPacks(selected, shuffled)).toEqual(selected);
    expect(parseCatalog(JSON.parse(JSON.stringify(selected)))).toEqual(selected);
    // A saved configuration round-trips, and parsing it twice changes nothing.
    const config = parseConfig({ schemaVersion: 1, harness: "codex", directory: "/workspace", packs: shuffled }, "/workspace");
    expect(parseConfig(config, "/workspace")).toEqual(config);
    expect(config.packs).toEqual(shuffled);
    const bad = random.pick([[...shuffled, shuffled[0]!], [...shuffled, "retired-skills"], [], ["../lp-skills"], ["LP-Skills"], [`${shuffled[0]}/..`]]);
    expect(() => selectPacks(reviewed, bad), `seed ${seed}: ${JSON.stringify(bad)}`).toThrow();
    if (bad.length && !bad.includes("retired-skills")) expect(() => parseConfig({ ...config, packs: bad }, "/workspace"), `seed ${seed}: ${JSON.stringify(bad)}`).toThrow();
  }
  expect(() => parseConfig({ schemaVersion: 1, harness: "codex", directory: "/workspace/../elsewhere" }, "/workspace")).toThrow("moved");
});

test("a sync record equal to the catalogue reports no change; any pin change names exactly its pack", () => {
  expect(catalogChanges(reviewed, real())).toEqual([]);
  for (let seed = 1; seed <= 300; seed++) {
    const random = seeded(seed);
    const previous = real();
    const pack = random.pick(previous.packs);
    const field = random.pick(["version", "revision", "skills", "path", "package", "source"] as const);
    if (field === "skills") pack.skills = [...pack.skills, "added-later"];
    else pack[field] = `${pack[field]}0`;
    const changes = catalogChanges(reviewed, previous);
    expect(changes, `seed ${seed}: ${pack.id}.${field}`).toHaveLength(1);
    expect(changes[0]).toStartWith(`${pack.id}: `);
    const retired = { ...real(), packs: real().packs.filter(item => item.id !== pack.id) };
    expect(catalogChanges(retired, real())).toEqual([`${pack.id}: retired from catalog; installed files preserved`]);
  }
});

test("the installed version is read back exactly, and unreadable frontmatter is an unknown version rather than a crash", () => {
  const fragments = ["metadata: [", "\tname: tab", "name: a\nname: a", "\"unterminated", "{", "- item", "metadata:\n  version: 1.2", "metadata: null", ": :", "&a [*a]", "key: 'open", "? [", "a: b: c", "\u0000", "version: \"1.0.0\"", "metadata:\n version:\n  - 1.0.0"];
  for (let seed = 1; seed <= 400; seed++) {
    const random = seeded(seed);
    const version = `${random.int(30)}.${random.int(30)}.${random.int(30)}`;
    const newline = random.pick(["\n", "\r\n"]);
    const quote = random.pick(["", "\"", "'"]);
    const good = ["---", `name: skill-${seed}`, "description: Example", "metadata:", `  version: ${quote}${version}${quote}`, "---", "", "# Body"].join(newline);
    expect(installedVersion(good), `seed ${seed}`).toBe(version);
    const garbage = Array.from({ length: 1 + random.int(3) }, () => random.pick(fragments)).join("\n");
    let result: string | undefined = "threw";
    expect(() => { result = installedVersion(`---\n${garbage}\n---\n`); }, `seed ${seed}: ${JSON.stringify(garbage)}`).not.toThrow();
    expect(result === undefined || typeof result === "string").toBe(true);
    expect(installedVersion(good.replace("---", "--"))).toBeUndefined();
  }
});

test("check names the damaged skill when its SKILL.md frontmatter no longer parses", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "boomkin-frontmatter-")));
  const catalog = selectPacks(reviewed, ["defi-data-skills"]);
  const pack = catalog.packs[0]!, skill = pack.skills[0]!;
  try {
    const integrity: SkillIntegrity = {};
    for (const name of pack.skills) {
      await mkdir(join(directory, "skills", name), { recursive: true });
      await writeFile(join(directory, "skills", name, "SKILL.md"), `---\nname: ${name}\nmetadata:\n  version: "${pack.version}"\n---\n`);
      integrity[name] = await skillFiles(join(directory, "skills", name));
    }
    await mkdir(join(directory, ".boomkin"));
    await writeFile(join(directory, ".boomkin/config.json"), JSON.stringify({ schemaVersion: 1, harness: "hermes", directory, packs: [pack.id] }));
    await writeFile(join(directory, ".boomkin/last-sync.json"), JSON.stringify({ syncedAt: "recorded", catalog, integrity }));
    await writeFile(join(directory, "skills", skill, "SKILL.md"), "---\nmetadata: [\n---\n");
    const child = Bun.spawn([process.execPath, "src/cli.ts", "check", "--directory", directory, "--offline-catalog"], { stdout: "pipe", stderr: "pipe" });
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(code).toBe(1);
    expect(stderr).toContain(`Installed ${skill} has version unknown; expected ${pack.version}`);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("recorded digests accept an untouched copy and flag any added, removed or edited file", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-integrity-property-"));
  const catalog = selectPacks(reviewed, ["defi-strategy-skills"]);
  const skill = catalog.packs[0]!.skills[0]!;
  expect(catalog.packs[0]!.skills).toHaveLength(1);
  try {
    for (let seed = 1; seed <= 40; seed++) {
      const random = seeded(seed);
      const source = join(root, `source-${seed}`), skills = join(root, `skills-${seed}`), installed = join(skills, skill);
      const files = ["SKILL.md", ...Array.from({ length: 1 + random.int(5) }, (_, index) => `${random.pick(["references", "scripts", "assets/nested"])}/file-${index}.${random.pick(["md", "mjs", "json"])}`)];
      for (const file of files) {
        await mkdir(dirname(join(source, file)), { recursive: true });
        await writeFile(join(source, file), `content ${seed} ${file} ${random.next()}`);
      }
      await cp(source, installed, { recursive: true });
      const integrity: SkillIntegrity = { [skill]: await verifyCopiedSkill(source, installed) };
      expect(Object.keys(integrity[skill]!).sort(), `seed ${seed}`).toEqual([...files].sort());
      expect(await verifyIntegrity(skills, catalog, integrity)).toEqual([]);
      expect(await verifyIntegrity(skills, catalog, JSON.parse(JSON.stringify(integrity)))).toEqual([]);
      const target = random.pick(files);
      const change = random.pick(["edit", "append", "remove", "add"] as const);
      if (change === "edit") await writeFile(join(installed, target), `content ${seed} ${target} changed`);
      else if (change === "append") await writeFile(join(installed, target), " ", { flag: "a" });
      else if (change === "remove") await rm(join(installed, target));
      else await writeFile(join(installed, "references-extra.md"), "unrecorded");
      expect(await verifyIntegrity(skills, catalog, integrity), `seed ${seed}: ${change} ${target}`).toHaveLength(1);
      if (change !== "add" && target !== "SKILL.md") await expect(verifyCopiedSkill(source, installed)).rejects.toThrow();
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
