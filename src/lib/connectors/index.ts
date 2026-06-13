import { ProductSearchConnector } from "../types";
import { SeedDataConnector } from "./seed-data";
import { GooglePlacesConnector } from "./google-places";
import { GoogleCustomSearchConnector } from "./google-search";
import { SerpApiConnector } from "./serpapi";
import { SerpApiWalmartConnector } from "./serpapi-walmart";
import { SerpApiShoppingConnector } from "./serpapi-shopping";
import { ALL_STUBS } from "./retailer-stubs";

const ALL_CONNECTORS: ProductSearchConnector[] = [
  new SeedDataConnector(),
  new GooglePlacesConnector(),
  new GoogleCustomSearchConnector(),
  new SerpApiConnector(),
  new SerpApiWalmartConnector(),
  new SerpApiShoppingConnector(),
  ...ALL_STUBS,
];

export function getEnabledConnectors(): ProductSearchConnector[] {
  return ALL_CONNECTORS.filter((c) => c.enabled());
}

export function getAllConnectors(): ProductSearchConnector[] {
  return ALL_CONNECTORS;
}
