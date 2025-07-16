import api from "$lib/server/vasttrafik";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, params }) => {
  try {
    const arrivals = await api.stopPointArrivals(params.gid, {
      includes: url.searchParams.getAll('includes')
    });
    return json(arrivals);
  } catch (error) {
    console.error("Error fetching arrivals:", error);
    return json({ error: "something went wrong" }, { status: 500 });
  }
};
