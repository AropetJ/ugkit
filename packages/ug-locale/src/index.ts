/**
 * @ugkit/locale
 *
 * Fast, typed Uganda administrative divisions.
 *
 * Import strategy:
 *   - `@ugkit/locale`             → types + districts + counties (light)
 *   - `@ugkit/locale/villages`    → the heavy leaf level, load on demand
 *
 * The barrel deliberately does NOT re-export parishes/villages so that a
 * bundler never drags multi-MB leaf data into an app that only renders a
 * district dropdown.
 */

export * from "./types.js";
export * from "./districts.js";
export * from "./counties.js";
