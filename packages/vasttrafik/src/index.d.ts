/**
 * Västtrafik API Type Definitions
 */

export type TransportMode = "tram" | "bus" | "ferry" | "train";

export interface JourneysParameters {
  /** The origin stop area GID */
  originGid: string;
  /** The destination stop area GID */
  destinationGid: string;
  /** The date and time for the journey in ISO 8601 format */
  dateTime?: string;
  /** Specifies if the datetime is related to the departure or arrival of the journey. */
  dateTimeRelatesTo?: "departure" | "arrival";
  /** The maximum number of results to return */
  limit?: number;
  /** Only include direct connections, e.g. journeys with one trip leg. */
  onlyDirectConnections?: boolean;
  /** The transport modes to include when searching for journeys, if none specified all transport modes are included. */
  transportModes?: Array<TransportMode>;
}

export interface JourneyDetailsParameters {
  includes?: Array<
    | "ticketsuggestions"
    | "triplegcoordinates"
    | "validzones"
    | "servicejourneycalls"
    | "servicejourneycoordinates"
    | "links"
    | "occupancy"
  >;
}

export interface JourneysResponse {
  /** Array of journey results */
  results: Journey[];
}

export interface TripLeg {
  isCancelled: boolean;
  serviceJourney: ServiceJourney;
}

export interface Journey {
  detailsReference: string;
  tripLegs: TripLeg[];
}

export interface Line {
  /** The unique identifier for the line */
  gid: string;
  /** The name of the line */
  name: string;
  /** The short name of the line */
  shortName: string;
  /** The designation of the line */
  designation: string;
  /** The background color of the line */
  backgroundColor: string;
  /** The foreground color of the line */
  foregroundColor: string;
  /** The border color of the line */
  borderColor: string;
  /** The mode of transport for the line */
  transportMode: TransportMode;
}

export interface ServiceJourney {
  /** The unique identifier for the service journey */
  gid: string;
  /** The origin of the service journey */
  origin?: string;
  /** The destination of the service journey */
  direction?: string;
  /** The line associated with the service journey */
  line: Line;
  serviceJourneyCoordinates?: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export interface Arrival {
  /** The reference to the details of the arrival */
  detailsReference: string;
  /** The service journey associated with the arrival */
  serviceJourney: ServiceJourney;
  /** The planned time of the arrival */
  plannedTime: string;
  /** The estimated time of the arrival */
  estimatedTime: string | null;
  /** Indicates if the arrival is cancelled */
  isCancelled: boolean;
}

export interface Departure {
  /** The reference to the details of the departure */
  detailsReference: string;
  /** The service journey associated with the departure */
  serviceJourney: ServiceJourney;
  /** The planned time of the departure */
  plannedTime: string;
  /** The estimated time of the departure */
  estimatedTime: string | null;
  /** Indicates if the departure is cancelled */
  isCancelled: boolean;
}

export interface StopArea {
  /** The unique identifier for the stop area */
  gid: string;
  /** The name of the stop area */
  name: string;
  /** The latitude of the stop area */
  lat: number;
  /** The longitude of the stop area */
  long: number;
}

export interface TokenResponse {
  /** The access token */
  access_token: string;
  /** Token expiration time in seconds */
  expires_in: number;
}

export interface ClientCredentialsConfig {
  /** Client ID for authentication */
  clientId: string;
  /** Client secret for authentication */
  clientSecret: string;
}

export interface CachedToken {
  /** The access token */
  access_token: string;
  /** Token expiration timestamp */
  expires_at: number;
}

export interface ArrivalsResponse {
  /** Array of arrival results */
  results: Arrival[];
}

export interface DeparturesResponse {
  /** Array of departure results */
  results: Departure[];
}

export interface VasttraffikClient {
  stopAreas(): Promise<StopArea[]>;
  stopAreaArrivals(gid: string): Promise<Arrival[]>;
  stopAreaDepartures(gid: string): Promise<Departure[]>;
}

export declare function createClient(
  config: ClientCredentialsConfig,
): VasttraffikClient;
