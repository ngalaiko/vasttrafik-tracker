import api from "$lib/server/vasttrafik";
import { json } from "@sveltejs/kit";

/**
 * Handles GET requests for stop point arrivals.
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, params }) {
  try {
    const arrivals = await api.stopPointArrivals(params.gid, url.searchParams);
    return json(arrivals);
  } catch (error) {
    console.error("Error fetching arrivals:", error);
    return json({ error: "something went wrong" }, { status: 500 });
  }
}
