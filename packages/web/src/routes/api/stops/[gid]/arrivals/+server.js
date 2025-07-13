import api from "$lib/server/vasttrafik";
import { json } from "@sveltejs/kit";

/**
 * Handles GET requests for stop area arrivals.
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ params }) {
  try {
    const arrivals = await api.stopAreaArrivals(params.gid);
    return json(arrivals);
  } catch (error) {
    console.error("Error fetching arrivals:", error);
    return json({ error: "something went wrong" }, { status: 500 });
  }
}
