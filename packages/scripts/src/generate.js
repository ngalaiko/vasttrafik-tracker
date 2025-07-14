import { parseArgs } from "util";
import { createClient } from "@vasttrafik-tracker/vasttrafik";

/**
 * Generates tram route data for key hubs in Gothenburg.
 * This script fetches tram lines, their routes, and stop details
 * from Västtrafik's API, focusing on main hubs.
 */
async function main() {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      "client-id": { type: "string", required: true },
      "client-secret": { type: "string", required: true },
    },
    strict: true,
    allowPositionals: true,
  });

  const client = createClient({
    clientId: values["client-id"],
    clientSecret: values["client-secret"],
  });

  // main hubs
  const hubNames = [
    "Brunnsparken",
    "Gamlestads Torg",
    "Hjalmar Brantingsplatsen",
    "Korsvägen",
    "Marklandsgatan",
    "Järntorget",
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
    .filter(Boolean);

  if (hubGids.length === 0) {
    throw new Error(
      `None of the hubs were found in stopAreas(): ${hubNames.join(", ")}`,
    );
  }

  // Gather unique tram lines with their departure detail refs and originating hub
  /** @type {Record<string, { detailsRef: string; hubGid: string }>} */
  const tramRefs = {};

  for (const gid of hubGids) {
    // stopAreaDepartures now returns { results, pagination, links }
    const resp = await client.stopAreaDepartures(gid, {
      includes: ["servicejourneycoordinates", "servicejourneycalls"],
    });
    const departures = resp.results || [];

    departures.forEach((dep) => {
      const { line } = dep.serviceJourney;
      const id = line.shortName || line.name || line.designation;
      if (line.transportMode === "tram" && id && !tramRefs[id]) {
        tramRefs[id] = { detailsRef: dep.detailsReference, hubGid: gid, line };
      }
    });
  }

  // For each tram line, fetch route geometry and stop list
  const routes = await Promise.all(
    Object.entries(tramRefs).map(
      async ([lineName, { detailsRef, hubGid, line }]) => {
        // departureDetails returns the details object directly
        const details = await client.stopAreaDepartureDetails(
          hubGid,
          detailsRef,
          { includes: ["servicejourneycoordinates", "servicejourneycalls"] },
        );

        // Extract first service journey
        const sj = details.serviceJourneys?.[0];
        if (!sj) {
          return { line: lineName, coordinates: [], stops: [] };
        }

        // Extract coordinates
        const coordinates =
          sj.serviceJourneyCoordinates?.map((c) => [c.latitude, c.longitude]) ??
          [];

        // Extract stops with defensive location parsing
        const stopPoints =
          sj.callsOnServiceJourney?.map((call) => {
            // stop point and area
            const sp = call.stopPoint || call;

            // stop point coords
            const spLat =
              sp.location?.latitude ?? sp.latitude ?? sp.lat ?? null;
            const spLon =
              sp.location?.longitude ?? sp.longitude ?? sp.long ?? null;

            return {
              gid: sp.gid,
              name: sp.name,
              location: { lat: spLat, lon: spLon },
            };
          }) ?? [];

        return { ...line, coordinates, stopPoints };
      },
    ),
  );

  // Output JSON
  await Bun.write(Bun.stdout, JSON.stringify(routes, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
