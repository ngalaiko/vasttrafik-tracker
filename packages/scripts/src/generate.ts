import { parseArgs } from 'node:util';
import { createClient, LineApiModel, StopPointApiModel } from '@vasttrafik-tracker/vasttrafik';

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      'client-id': { type: 'string', required: true },
      'client-secret': { type: 'string', required: true },
    },
    strict: true,
    allowPositionals: true,
  });

  const client = createClient({
    clientId: values['client-id']!,
    clientSecret: values['client-secret']!,
  });

  // main hubs
  const initialHubs = [
    'Brunnsparken',
    'Gamlestads Torg',
    'Hjalmar Brantingsplatsen',
    'Korsvägen',
    'Marklandsgatan',
    'Järntorget',
    'Seminariegatan',
  ];

  // Fetch all stop areas
  const allAreas = await client.stopAreas();

  // Map hub names to GIDs
  const hubGids = initialHubs
    .map((name) => {
      const area = allAreas.find((a) => a.name === name);
      if (!area) console.warn(`⚠️ Hub not found: "${name}"`);
      return area?.gid;
    })
    .filter((gid): gid is string => Boolean(gid));

  const refs = await Promise.all(
    hubGids.map(async (gid) => {
      const departures = await client
        .stopAreaDepartures(gid, {
          includes: ['servicejourneycoordinates', 'servicejourneycalls'],
        })
        .then((res) => res.results || []);
      const arrivals = await client
        .stopAreaArrivals(gid, {
          includes: ['servicejourneycoordinates', 'servicejourneycalls'],
        })
        .then((res) => res.results || []);
      return arrivals
        .concat(departures)
        .filter((arr) => arr.serviceJourney.line.transportMode === 'tram')
        .map((arr) => ({
          hubGid: gid,
          detailsReference: arr.detailsReference,
        }));
    })
  );

  type Route = LineApiModel & {
    stopPoints: StopPointApiModel[];
    coordinates: [number, number][];
  };
  const routes: Route[] = await Promise.all(
    refs.flat().map(async ({ detailsReference, hubGid }) => {
      const details = await client.stopAreaDepartureDetails(hubGid, detailsReference, {
        includes: ['servicejourneycoordinates', 'servicejourneycalls'],
      });

      // Extract coordinates and stop points from the first service journey
      const serviceJourney = details.serviceJourneys[0];
      return {
        ...serviceJourney.line,
        stopPoints: serviceJourney.callsOnServiceJourney!.map(({ stopPoint }) => stopPoint),
        coordinates: serviceJourney.serviceJourneyCoordinates!.map(({ latitude, longitude }) => [
          latitude,
          longitude,
        ]),
      };
    })
  );

  const routePerLineDirection = routes.reduce(
    (acc: Record<string, Route[]>, route: Route) => {
      const key = `${route.name}-${route.stopPoints.at(0)?.gid}-${route.stopPoints.at(-1)?.gid}`;
      if (!acc[key]) {
        acc[key] = [route];
      } else {
        acc[key].push(route);
      }
      return acc;
    },
    {} as Record<string, Route[]>
  );

  // for each line, only keep the route with the most stops
  const uniqueRoutes = Object.values(routePerLineDirection).map((lineRoutes) => {
    // Sort routes by number of stops, descending
    lineRoutes.sort((a, b) => (b.stopPoints?.length || 0) - (a.stopPoints?.length || 0));
    // Return the route with the most stops
    return lineRoutes[0];
  });

  // Output JSON
  await Bun.write(Bun.stdout, JSON.stringify(uniqueRoutes, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
