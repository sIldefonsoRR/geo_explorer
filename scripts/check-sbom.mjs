// CI check: fails if sbom.cdx.json is out of sync with package-lock.json.
// Regenerates the SBOM in memory and compares only lockfile-derived content.
// Ignored: serialNumber and metadata.timestamp/tools (change on every run or
// npm version), and metadata.component.name (npm uses the checkout folder name).
// Fix a failure with `npm run sbom` and commit the result.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SBOM_PATH = path.join(ROOT, "sbom.cdx.json");

function normalize(sbom) {
  const { component } = sbom.metadata;
  return {
    root: { purl: component.purl, version: component.version },
    components: sbom.components
      .map((c) => ({
        ref: c["bom-ref"],
        purl: c.purl,
        scope: c.scope ?? null,
        hashes: (c.hashes ?? []).map((h) => `${h.alg}:${h.content}`).sort(),
        licenses: (c.licenses ?? []).map((l) => l.license?.id ?? l.license?.name ?? l.expression).sort(),
      }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
    dependencies: sbom.dependencies
      .map((d) => ({ ref: d.ref, dependsOn: [...(d.dependsOn ?? [])].sort() }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
  };
}

const committed = normalize(JSON.parse(fs.readFileSync(SBOM_PATH, "utf-8")));
const fresh = normalize(
  JSON.parse(
    execFileSync("npm", ["sbom", "--sbom-format", "cyclonedx", "--package-lock-only"], {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === "win32",
    }),
  ),
);

if (JSON.stringify(committed) !== JSON.stringify(fresh)) {
  const refs = (s) => new Set(s.components.map((c) => c.ref));
  const [had, has] = [refs(committed), refs(fresh)];
  const added = [...has].filter((r) => !had.has(r));
  const removed = [...had].filter((r) => !has.has(r));
  console.error("sbom.cdx.json is out of sync with package-lock.json.");
  if (added.length) console.error(`  missing from SBOM: ${added.join(", ")}`);
  if (removed.length) console.error(`  stale in SBOM: ${removed.join(", ")}`);
  if (!added.length && !removed.length) console.error("  component metadata or dependency graph differs.");
  console.error("Run `npm run sbom` and commit the result.");
  process.exit(1);
}

console.log(`sbom.cdx.json is in sync (${fresh.components.length} components).`);
