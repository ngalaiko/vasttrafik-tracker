import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createClient } from '@vasttrafik-tracker/vasttrafik'

const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../web/src/lib/lines/lines.json'
)

async function main() {
  const { values } = parseArgs({
    args: process.argv,
    options: {
      'client-id': { type: 'string', required: true },
      'client-secret': { type: 'string', required: true }
    },
    strict: true,
    allowPositionals: true
  })

  const clientId = values['client-id']
  const clientSecret = values['client-secret']
  if (!clientId || !clientSecret) {
    throw new Error('--client-id and --client-secret are required')
  }

  const client = createClient({ clientId, clientSecret })

  // main hubs
  const initialHubs = [
    'Brunnsparken',
    'Gamlestads Torg',
    'Hjalmar Brantingsplatsen',
    'Korsvägen',
    'Marklandsgatan',
    'Järntorget',
    'Seminariegatan'
  ]

  // Fetch all stop areas
  const allAreas = await client.stopAreas()

  // Map hub names to GIDs
  const hubGids = initialHubs
    .map(name => {
      const area = allAreas.find(a => a.name === name)
      if (!area) console.warn(`⚠️ Hub not found: "${name}"`)
      return area?.gid
    })
    .filter((gid): gid is string => Boolean(gid))

  const refs = await Promise.all(
    hubGids.map(async gid => {
      const departures = await client
        .stopAreaDepartures(gid, {
          includes: ['servicejourneycoordinates', 'servicejourneycalls']
        })
        .then(res => res.results || [])

      const arrivals = await client
        .stopAreaArrivals(gid, {
          includes: ['servicejourneycoordinates', 'servicejourneycalls']
        })
        .then(res => res.results || [])

      return [...arrivals, ...departures]
        .filter(item => item.serviceJourney.line.transportMode === 'tram')
        .map(item => ({
          hubGid: gid,
          detailsReference: item.detailsReference
        }))
    })
  )

  const routes = await Promise.all(
    refs.flat().map(async ({ detailsReference, hubGid }) => {
      const details = await client.stopAreaDepartureDetails(
        hubGid,
        detailsReference,
        {
          includes: ['servicejourneycoordinates', 'servicejourneycalls']
        }
      )

      const serviceJourney = details.serviceJourneys[0]
      if (
        !serviceJourney?.callsOnServiceJourney ||
        !serviceJourney.serviceJourneyCoordinates
      ) {
        return null
      }

      const { name, backgroundColor, foregroundColor, borderColor, transportMode } =
        serviceJourney.line

      return {
        name,
        backgroundColor,
        foregroundColor,
        borderColor,
        transportMode,
        stopPoints: serviceJourney.callsOnServiceJourney.map(({ stopPoint }) => ({
          gid: stopPoint.gid,
          name: stopPoint.name,
          latitude: stopPoint.latitude,
          longitude: stopPoint.longitude
        })),
        coordinates: serviceJourney.serviceJourneyCoordinates.map(
          ({ latitude, longitude }) => [latitude, longitude]
        )
      }
    })
  )

  const validRoutes = routes.filter(r => r !== null)

  const routePerLineDirection: Record<string, typeof validRoutes> = {}
  for (const route of validRoutes) {
    const key = `${route.name}-${route.stopPoints.at(0)?.gid}-${route.stopPoints.at(-1)?.gid}`
    if (!routePerLineDirection[key]) {
      routePerLineDirection[key] = [route]
    } else {
      routePerLineDirection[key].push(route)
    }
  }

  // for each line, only keep the route with the most stops
  const uniqueRoutes = Object.values(routePerLineDirection).map(
    lineRoutes => {
      lineRoutes.sort(
        (a, b) => (b.stopPoints?.length || 0) - (a.stopPoints?.length || 0)
      )
      return lineRoutes[0]
    }
  )

  writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueRoutes, null, 2) + '\n')
  console.log(`Wrote ${uniqueRoutes.length} lines to ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
