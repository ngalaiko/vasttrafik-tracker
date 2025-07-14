import lines from "./lines.json";

/**
 * Loads stop areas data for the page.
 * @type {import('./$types').PageServerLoad}
 */
export async function load() {
  return {
    lines,
  };
}
