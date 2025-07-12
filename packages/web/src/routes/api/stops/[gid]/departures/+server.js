import api from "$lib/server/vasttrafik";
import { json } from "@sveltejs/kit";

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
  try {
    const departures = await api.stopAreaDepartures(params.gid);
    return json(departures);
  } catch (error) {
    console.error("Error fetching departures:", error);
    return json({ error: "something went wrong" }, { status: 500 });
  }
}

