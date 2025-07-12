import api from "$lib/server/vasttrafik";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const stopAreas = await api.stopAreas();
  return {
    stopAreas,
  };
}
