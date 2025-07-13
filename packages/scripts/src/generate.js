import { parseArgs } from "util";
import { createClient } from "@vasttrafik-tracker/vasttrafik";
import trams from "./trams/trams.json";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    "client-id": {
      type: "string",
      required: true,
    },
    "client-secret": {
      type: "string",
      required: true,
    },
  },
  strict: true,
  allowPositionals: true,
});

const outputFile =
  positionals.length > 2 ? Bun.file(positionals[2]) : Bun.stdout;

// Create client
const client = createClient({
  clientId: values["client-id"],
  clientSecret: values["client-secret"],
});

/**
 * Fetches journey details for a tram between two stop areas.
 * @param {import('./trams').Tram} tram - The tram object containing origin and destination.
 * @param {import("@vasttrafik-tracker/vasttrafik").StopArea} stopAreas - The list of stop areas to search in.
 * @returns {Promise<import("@vasttrafik-tracker/vasttrafik").JourneyDetails>} - The journey details for the tram.
 */
async function fetchJourneyDetails(tram, stopAreas) {
  const origin = stopAreas.find((area) => area.name === tram.origin);
  const destination = stopAreas.find((area) => area.name === tram.destination);

  if (!origin || !destination) {
    throw new Error(
      `Stop area not found for tram: ${tram.origin} -> ${tram.destination}`,
    );
  }

  const journeys = await client.journeys({
    originGid: origin.gid,
    destinationGid: destination.gid,
    transportModes: ["tram"],
    onlyDirectConnections: true,
    limit: 1,
  });

  if (journeys.length === 0) {
    throw new Error(
      `No journeys found for tram: ${tram.origin} -> ${tram.destination}`,
    );
  }

  const details = await client.journeyDetails(journeys[0].detailsReference, {
    includes: ["servicejourneycoordinates"],
  });

  return details;
}

try {
  const stopAreas = await client.stopAreas();

  const journeys = await Promise.all(
    trams.map((tram) => fetchJourneyDetails(tram, stopAreas)),
  );

  const lineCoordinates = journeys.map((journey) => {
    const serviceJourney = journey.tripLegs[0].serviceJourneys[0];
    return {
      line: serviceJourney.line,
      coordinates: serviceJourney.serviceJourneyCoordinates,
    };
  });

  await Bun.write(outputFile, JSON.stringify(lineCoordinates, null, 2));
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
