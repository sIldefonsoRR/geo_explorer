import type { City, Country, SearchResult } from "./types";

const MAX_RESULTS = 10;

export function search(
  query: string,
  cities: City[],
  countries: Country[],
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const cityMatches: SearchResult[] = cities
    .filter((c) => c.city.toLowerCase().includes(q))
    .sort((a, b) => b.population - a.population)
    .slice(0, MAX_RESULTS)
    .map((item) => ({ type: "city", item }));

  const countryMatches: SearchResult[] = countries
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS)
    .map((item) => ({ type: "country", item }));

  return [...countryMatches, ...cityMatches].slice(0, MAX_RESULTS);
}
