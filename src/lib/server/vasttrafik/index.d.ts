/**
 * Västtrafik API Type Definitions
 */

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
  transportMode: "tram" | "bus" | "ferry" | "train";
}

export interface ServiceJourney {
  /** The unique identifier for the service journey */
  gid: string;
  /** The origin of the service journey */
  origin: string;
  /** The line associated with the service journey */
  line: Line;
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

export declare function stopAreas(): Promise<StopArea[]>;
export declare function stopAreaArrivals(gid: string): Promise<Arrival[]>;
export declare function stopAreaDepartures(gid: string): Promise<Departure[]>;

declare const _default: {
  stopAreas: typeof stopAreas;
  stopAreaArrivals: typeof stopAreaArrivals;
  stopAreaDepartures: typeof stopAreaDepartures;
};

export default _default;
