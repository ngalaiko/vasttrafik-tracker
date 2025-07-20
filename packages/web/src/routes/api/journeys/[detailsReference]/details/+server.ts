import api from '$lib/server/vasttrafik';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TTLCache } from '$lib/cache';

const cache = new TTLCache();

export const GET: RequestHandler = async ({ params }) => {
  try {
    const cacheKey = `journeyDetails-${params.detailsReference}}`;
    const details = await cache.get(cacheKey, () => api.journeyDetails(params.detailsReference));
    return json(details);
  } catch (error) {
    console.error('Error fetching arrivals:', error);
    return json({ error: 'something went wrong' }, { status: 500 });
  }
};
