import { parseArgs } from 'node:util';
import { createClient, type LineApiModel } from '@vasttrafik-tracker/vasttrafik';

interface TramRef {
  detailsRef: string;
  hubGid: string;
  line: LineApiModel;
}

interface StopPoint {
  gid: string;
  name: string;
  location: { lat: number | null; lon: number | null };
}

interface Route extends LineApiModel {
  coordinates: [number, number][];
  stopPoints: StopPoint[];
}

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
  const hubNames = [
    'Brunnsparken',
    'Gamlestads Torg',
    'Hjalmar Brantingsplatsen',
    'Korsvägen',
    'Marklandsgatan',
    'Järntorget',
  ];

  // Fetch all stop areas
  const allAreas = await client.stopAreas();

  // Map hub names to GIDs
  const hubGids = hubNames
    .map((name) => {
      const area = allAreas.find((a) => a.name === name);
      if (!area) console.warn(`⚠️ Hub not found: "${name}"`);
      return area?.gid;
    })
    .filter((gid): gid is string => Boolean(gid));

  if (hubGids.length === 0) {
    throw new Error(`None of the hubs were found in stopAreas(): ${hubNames.join(', ')}`);
  }

  // Gather unique tram lines with their departure detail refs and originating hub
  const tramRefs: Record<string, TramRef> = {};

  for (const gid of hubGids) {
    // stopAreaDepartures now returns { results, pagination, links }
    const resp = await client.stopAreaDepartures(gid, {
      includes: ['servicejourneycoordinates', 'servicejourneycalls'],
    });
    const departures = resp.results || [];

    departures.forEach((dep) => {
      const { line } = dep.serviceJourney;
      const id = line.shortName || line.name || line.designation;
      if (line.transportMode === 'tram' && id && !tramRefs[id] && dep.detailsReference) {
        tramRefs[id] = { detailsRef: dep.detailsReference, hubGid: gid, line };
      }
    });
  }

  // For each tram line, fetch route geometry and stop list
  const routes: Route[] = await Promise.all(
    Object.entries(tramRefs).map(async ([, { detailsRef, hubGid, line }]): Promise<Route> => {
      // stopAreaDepartureDetails now returns DepartureDetailsApiModel with serviceJourneys
      const details = await client.stopAreaDepartureDetails(hubGid, detailsRef!, {
        includes: ['servicejourneycoordinates', 'servicejourneycalls'],
      });

      // Extract coordinates and stop points from the first service journey
      const serviceJourney = details.serviceJourneys?.[0];
      if (!serviceJourney) {
        return { ...line, coordinates: [], stopPoints: [] };
      }

      // Extract coordinates from serviceJourneyCoordinates
      const coordinates: [number, number][] =
        serviceJourney.serviceJourneyCoordinates?.map((coord) => [
          coord.latitude,
          coord.longitude,
        ]) || [];

      // Extract stop points from callsOnServiceJourney
      const stopPoints: StopPoint[] =
        serviceJourney.callsOnServiceJourney?.map((call) => ({
          gid: call.stopPoint.gid,
          name: call.stopPoint.name,
          location: {
            lat: call.latitude || call.stopPoint.latitude || null,
            lon: call.longitude || call.stopPoint.longitude || null,
          },
        })) || [];

      return { ...line, coordinates, stopPoints };
    })
  );

  // Output JSON
  await Bun.write(Bun.stdout, JSON.stringify(routes, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
