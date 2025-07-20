import api from '$lib/server/vasttrafik';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TTLCache } from '$lib/cache';

const cache = new TTLCache();

export const GET: RequestHandler = async ({ url, params }) => {
  try {
    const maxArrivalsPerLineAndDirection = url.searchParams.get('maxArrivalsPerLineAndDirection');
    const cacheKey = `arrivals-${params.gid}}`;
    const arrivals = await cache.get(cacheKey, () =>
      api.stopPointArrivals(params.gid, {
        maxArrivalsPerLineAndDirection: Number(maxArrivalsPerLineAndDirection) || undefined,
      })
    );
    return json(arrivals);
  } catch (error) {
    console.error('Error fetching arrivals:', error);
    return json({ error: 'something went wrong' }, { status: 500 });
  }
};
