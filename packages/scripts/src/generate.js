import { parseArgs } from "util";
import { createClient } from "@vasttrafik-tracker/vasttrafik";
import trams from "./trams.json";

const { values } = parseArgs({
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

const client = createClient({
  clientId: values["client-id"],
  clientSecret: values["client-secret"],
});

const stopAreas = await client.stopAreas();

const journeys = await Promise.all(
  trams.map(async (tram) => {
    const origin = stopAreas.find((area) => area.name === tram.origin);
    const destination = stopAreas.find(
      (area) => area.name === tram.destination,
    );

    return await client.journeys({
      originGid: origin.gid,
      destinationGid: destination.gid,
      transportModes: ["tram"],
      limit: 1,
    });
  }),
);

console.log(journeys);
