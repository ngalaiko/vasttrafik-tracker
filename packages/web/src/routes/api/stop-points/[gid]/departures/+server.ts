import api from "$lib/server/vasttrafik";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, params }) => {
  try {
    const departures = await api.stopPointDepartures(params.gid, {
      includes: url.searchParams.getAll('includes')
    });
    return json(departures);
  } catch (error) {
    console.error("Error fetching departures:", error);
    return json({ error: "something went wrong" }, { status: 500 });
  }
};
