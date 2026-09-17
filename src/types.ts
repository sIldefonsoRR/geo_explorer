export interface City {
  id: number;
  city: string;
  countryCode: string;
  countryName: string;
  region: string | null;
  population: number;
  lat: number;
  lng: number;
}

export interface Country {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export type SearchResult =
  | { type: "city"; item: City }
  | { type: "country"; item: Country };
