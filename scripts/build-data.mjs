// Build-time script: converts the raw CSV data dumps into small static JSON
// files consumed by the frontend. Not part of the dev/build hot path — rerun
// manually with `npm run build:data` whenever the source CSVs change.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { parse as parseStream } from "csv-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "data");

fs.mkdirSync(OUT_DIR, { recursive: true });

// --- Countries -------------------------------------------------------------
const countriesRaw = fs.readFileSync(path.join(ROOT, "countries.csv"), "utf-8");
const countryRows = parse(countriesRaw, {
  columns: true,
  skip_empty_lines: true,
});

const countryNameByCode = new Map();
for (const row of countryRows) {
  if (!row.Code) continue;
  countryNameByCode.set(row.Code.toUpperCase(), row.Name);
}

// --- Cities (streamed: source file is ~160MB / 3.1M rows) ------------------
const cities = [];
const centroidSums = new Map(); // code -> { latSum, lngSum, count }
let id = 0;

const parser = fs
  .createReadStream(path.join(ROOT, "cities.csv"))
  .pipe(parseStream({ columns: true }));

for await (const record of parser) {
  const population = Number(record.Population);
  if (!population || population <= 0) continue;

  const lat = Number(record.Latitude);
  const lng = Number(record.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  const countryCode = (record.Country || "").toUpperCase();
  const countryName = countryNameByCode.get(countryCode) ?? countryCode;

  cities.push({
    id: id++,
    city: record.AccentCity || record.City,
    countryCode,
    countryName,
    region: record.Region || null,
    population,
    lat,
    lng,
  });

  const sums = centroidSums.get(countryCode) ?? { latSum: 0, lngSum: 0, count: 0 };
  sums.latSum += lat;
  sums.lngSum += lng;
  sums.count += 1;
  centroidSums.set(countryCode, sums);
}

const countries = [];
for (const [code, name] of countryNameByCode) {
  const sums = centroidSums.get(code);
  if (!sums) continue; // no populated cities to derive a centroid from
  countries.push({
    code,
    name,
    lat: sums.latSum / sums.count,
    lng: sums.lngSum / sums.count,
  });
}

fs.writeFileSync(path.join(OUT_DIR, "cities.json"), JSON.stringify(cities));
fs.writeFileSync(path.join(OUT_DIR, "countries.json"), JSON.stringify(countries));

console.log(`Wrote ${cities.length} cities and ${countries.length} countries to ${OUT_DIR}`);
