/**
 * @ugkit/locale
 *
 * Fast, typed Uganda administrative divisions.
 *
 * Import strategy:
 *   - `@ugkit/locale`             → types + districts + counties (light)
 *   - `@ugkit/locale/villages`    → the heavy leaf level, load on demand
 *
 * The barrel deliberately does NOT re-export subcounties/parishes/villages so
 * that a bundler never drags multi-MB leaf data into an app that only renders
 * a district dropdown.
 *
 * NOTE: counties is re-exported by explicit names — both level modules export
 * `datasetVersion`, and ambiguous `export *` names are silently dropped by
 * ESM resolution. The canonical `datasetVersion` comes from districts.
 */

export * from "./types.js";
export * from "./districts.js";
export {
  counties,
  countyById,
  countyByName,
  countyByCode,
  searchCounties,
  countyCount,
} from "./counties.js";
