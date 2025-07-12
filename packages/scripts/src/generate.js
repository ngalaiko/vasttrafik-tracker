import { parseArgs } from "util";
import { createClient } from "@vasttrafik-tracker/vasttrafik";

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

const trams = [
  {
    line: "1",
    origin: "Östra Sjukhuset",
    destination: "Opaltorget",
  },
  {
    line: "2",
    origin: "Mölndals Innerstad",
    destination: "Axel Dahlströms Torg",
  },
  {
    line: "3",
    origin: "Östra Sjukhuset",
    destination: "Marklandsgatan",
  },
  {
    line: "4",
    origin: "Angered Centrum",
    destination: "Mölndals Innerstad",
  },
  {
    line: "5",
    origin: "Varmfrontsgatan",
    destination: "Östra Sjukhuset",
  },
  {
    line: "6",
    origin: "Varmfrontsgatan",
    destination: "Aprilgatan",
  },
  {
    line: "7",
    origin: "Komettorget",
    destination: "Opaltorget",
  },
  {
    line: "8",
    origin: "Angered Centrum",
    destination: "Frölunda Torg",
  },
  {
    line: "9",
    origin: "Angered Centrum",
    destination: "Kungssten",
  },
  {
    line: "10",
    origin: "Väderilsgatan",
    destination: "Doktor Sydows Gata",
  },
  {
    line: "11",
    origin: "Komettorget",
    destination: "Saltholmen",
  },
];

for (const tram of trams) {
  const origin = stopAreas.find((area) => area.name === tram.origin);
  const destination = stopAreas.find((area) => area.name === tram.destination);
  const journeys = await client.journeys({
    originGid: origin.gid,
    destinationGid: destination.gid,
    transportModes: ["tram"],
    limit: 1,
  });
  console.log(journeys);
  break;
}
