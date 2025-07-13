import api from "$lib/server/vasttrafik";
import lines from "./lines.json";

/**
 * Loads stop areas data for the page.
 * @type {import('./$types').PageServerLoad}
 */
export async function load() {
  const stopAreas = await api.stopAreas();
  return {
    stopAreas,
    lines,
  };
}
