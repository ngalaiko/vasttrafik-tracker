import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createClient } from '@vasttrafik-tracker/vasttrafik'

const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../web/src/lib/lines/lines.json'
)

interface Stop {
  gid: string
  name: string
  position: [number, number]
}

interface Route {
  name: string
  direction: string
  colors: {
    background: string
    foreground: string
    border: string
  }
  stops: Stop[]
  coordinates: Array<[number, number]>
}

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

      const { name, backgroundColor, foregroundColor, borderColor } =
        serviceJourney.line

      const stops: Stop[] = serviceJourney.callsOnServiceJourney.map(
        ({ stopPoint }) => ({
          gid: stopPoint.gid,
          name: stopPoint.name,
          position: [stopPoint.latitude, stopPoint.longitude] as [
            number,
            number
          ]
        })
      )

      const lastStop = stops[stops.length - 1]
      if (!lastStop) return null

      const route: Route = {
        name,
        direction: lastStop.name,
        colors: {
          background: backgroundColor,
          foreground: foregroundColor,
          border: borderColor
        },
        stops,
        coordinates: serviceJourney.serviceJourneyCoordinates.map(
          ({ latitude, longitude }): [number, number] => [latitude, longitude]
        )
      }

      return route
    })
  )

  const validRoutes = routes.filter((r): r is Route => r !== null)

  const routePerLineDirection: Record<string, Route[]> = {}
  for (const route of validRoutes) {
    const key = `${route.name}-${route.stops.at(0)?.gid}-${route.stops.at(-1)?.gid}`
    if (!routePerLineDirection[key]) {
      routePerLineDirection[key] = [route]
    } else {
      routePerLineDirection[key].push(route)
    }
  }

  // for each line+direction, only keep the route with the most stops
  const uniqueRoutes = Object.values(routePerLineDirection)
    .map(lineRoutes => {
      lineRoutes.sort((a, b) => b.stops.length - a.stops.length)
      return lineRoutes[0]!
    })
    .sort((a, b) => {
      const numA = parseInt(a.name, 10) || 0
      const numB = parseInt(b.name, 10) || 0
      if (numA !== numB) return numA - numB
      return a.direction.localeCompare(b.direction)
    })

  writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueRoutes, null, 2) + '\n')
  console.log(`Wrote ${uniqueRoutes.length} routes to ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
