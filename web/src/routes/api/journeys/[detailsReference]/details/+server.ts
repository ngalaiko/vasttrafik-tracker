import api from '$lib/server/vasttrafik'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { TTLCache } from '$lib/cache'

const cache = new TTLCache()

export const GET: RequestHandler = async ({ url, params }) => {
  try {
    const includes =
      url.searchParams
        .get('includes')
        ?.split(',')
        .filter(i => i === 'triplegcoordinates') || []
    const cacheKey = `journeyDetails-${params.detailsReference}-${includes}`
    const details = await cache.get(cacheKey, () =>
      api.journeyDetails(params.detailsReference, {
        includes: includes
      })
    )
    return json(details)
  } catch (error) {
    console.error('Error fetching arrivals:', error)
    return json({ error: 'something went wrong' }, { status: 500 })
  }
}
