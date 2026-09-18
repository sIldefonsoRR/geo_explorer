import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { City, Country, SearchResult } from "./types";
import { search } from "./search";

// Leaflet's default marker icon resolves image URLs relative to its own
// script location at runtime, which breaks once Vite bundles/hashes
// assets. Point it at the Vite-resolved (and hashed) asset URLs instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-90, -180],
  [90, 180],
];

const mapContainer = document.getElementById("map")!;
const widthFitZoom = Math.ceil(Math.log2(mapContainer.clientWidth / 256));

const map = L.map("map", {
  worldCopyJump: false,
  maxBounds: WORLD_BOUNDS,
  maxBoundsViscosity: 1.0,
  zoomControl: false,
  minZoom: widthFitZoom,
  maxZoom: 6,
});
L.control.zoom({ position: "bottomright" }).addTo(map);

const INITIAL_VIEW: [L.LatLngExpression, number] = [[20, 0], widthFitZoom];
map.setView(...INITIAL_VIEW);

const ResetViewControl = L.Control.extend({
  options: { position: "bottomright" },
  onAdd(): HTMLElement {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    const link = L.DomUtil.create("a", "", container);
    link.href = "#";
    link.title = "Reset view";
    link.innerHTML = "⟲";
    link.setAttribute("role", "button");
    L.DomEvent.on(link, "click", L.DomEvent.stop).on(link, "click", () => {
      map.setView(...INITIAL_VIEW);
    });
    return container;
  },
});
new ResetViewControl().addTo(map);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "&copy; Esri",
    maxZoom: 6,
    noWrap: true,
  },
).addTo(map);

fetch("/data/countries-boundaries.geojson")
  .then((res) => res.json())
  .then((geojson) => {
    L.geoJSON(geojson, {
      style: {
        color: "#3388ff",
        weight: 1,
        fillOpacity: 0.05,
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name;
        if (!name) return;
        layer.bindTooltip(name, {
          permanent: true,
          direction: "center",
          className: "country-label",
        });
      },
    }).addTo(map);
  })
  .catch(() => {
    // boundaries are a visual overlay; map still works without them
  });

const showCountryNames = document.getElementById("show-country-names") as HTMLInputElement;
showCountryNames.addEventListener("change", () => {
  mapContainer.classList.toggle("show-country-names", showCountryNames.checked);
});

let activeMarker: L.Marker | null = null;

function showResult(result: SearchResult): void {
  const popupHtml = result.type === "city" ? cityPopup(result.item) : countryPopup(result.item);
  const { lat, lng } = result.item;

  if (activeMarker) {
    activeMarker.remove();
  }
  activeMarker = L.marker([lat, lng]).addTo(map).bindPopup(popupHtml).openPopup();
  map.flyTo([lat, lng], result.type === "city" ? 10 : 5);
}

function cityPopup(city: City): string {
  const flagCode = city.countryCode.toLowerCase();
  return `
    <img src="/flags/${flagCode}.svg" width="20" alt="" onerror="this.style.display='none'"/>
    <strong>${escapeHtml(city.city)}</strong><br/>
    ${escapeHtml(city.countryName)}${city.region ? ` (region ${escapeHtml(city.region)})` : ""}<br/>
    Population: ${city.population.toLocaleString()}<br/>
    ${city.lat.toFixed(4)}, ${city.lng.toFixed(4)}
  `;
}

function countryPopup(country: Country): string {
  return `
    <strong>${escapeHtml(country.name)}</strong> (${escapeHtml(country.code)})<br/>
    Centroid (derived from city data): ${country.lat.toFixed(4)}, ${country.lng.toFixed(4)}
  `;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadData(): Promise<{ cities: City[]; countries: Country[] }> {
  const [citiesRes, countriesRes] = await Promise.all([
    fetch("/data/cities.json"),
    fetch("/data/countries.json"),
  ]);
  if (!citiesRes.ok || !countriesRes.ok) {
    throw new Error("Failed to load map data");
  }
  const [cities, countries] = await Promise.all([citiesRes.json(), countriesRes.json()]);
  return { cities, countries };
}

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), ms);
  };
}

function resultLabel(result: SearchResult): string {
  return result.type === "city"
    ? `${result.item.city}, ${result.item.countryName}`
    : result.item.name;
}

async function init(): Promise<void> {
  const input = document.getElementById("search-input") as HTMLInputElement;
  const resultsList = document.getElementById("search-results") as HTMLUListElement;

  let cities: City[] = [];
  let countries: Country[] = [];

  try {
    const data = await loadData();
    cities = data.cities;
    countries = data.countries;
  } catch {
    resultsList.innerHTML = `<li class="search-error">Could not load map data.</li>`;
    return;
  }

  function renderResults(results: SearchResult[]): void {
    resultsList.innerHTML = "";
    if (results.length === 0) {
      if (input.value.trim()) {
        resultsList.innerHTML = `<li class="search-empty">No results</li>`;
      }
      return;
    }
    for (const result of results) {
      const li = document.createElement("li");
      li.textContent = resultLabel(result);
      li.className = `result-${result.type}`;
      li.addEventListener("click", () => {
        showResult(result);
        resultsList.innerHTML = "";
        input.value = resultLabel(result);
      });
      resultsList.appendChild(li);
    }
  }

  const onInput = debounce(() => {
    renderResults(search(input.value, cities, countries));
  }, 150);

  input.addEventListener("input", onInput);
}

init();
