import api from "$lib/server/vasttrafik";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const stopAreas = await api.stopAreas();

  console.log("Loaded stop areas:", stopAreas);
  return {
    stopAreas,
  };
}
