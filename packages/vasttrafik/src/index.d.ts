/**
 * Västtrafik Planner API v4 (Travel Planner)
 * OpenAPI 3.0.1
 * Base URL: https://ext-api.vasttrafik.se/pr/v4
 */

////////////////////////////////////
// OAuth2 Token Response
////////////////////////////////////
/**
 * OAuth2 token response
 */
export interface TokenResponse {
  /** Access token string */
  access_token: string;
  /** Lifetime in seconds */
  expires_in: number;
}

////////////////////////////////////
// Pagination
////////////////////////////////////
/**
 * Pagination properties returned in responses
 */
export interface PaginationProperties {
  /** Requested number of results */
  limit: number;
  /** Requested offset */
  offset: number;
  /** Actual number of returned results */
  size: number;
}

/**
 * Pagination navigation links
 */
export interface PaginationLinks {
  /** Link to previous page, or null */
  previous: string | null;
  /** Link to next page, or null */
  next: string | null;
  /** Link to current page */
  current: string | null;
}

/**
 * Generic API response wrapping a list of T
 */
export interface ApiResponse<T> {
  /** Array of items or null */
  results: T[] | null;
  /** Pagination info */
  pagination: PaginationProperties;
  /** Pagination links */
  links: PaginationLinks;
}

////////////////////////////////////
// Common Types
////////////////////////////////////
/** Transport modes */
export type TransportMode =
  | "tram"
  | "bus"
  | "ferry"
  | "train"
  | "taxi"
  | "walk"
  | "bike"
  | "car"
  | "none"
  | "unknown"
  | "teletaxi";

/** Sub-modes of transport (trains etc) */
export type JourneyTransportSubMode =
  | "vasttagen"
  | "longdistancetrain"
  | "regionaltrain"
  | "flygbussarna"
  | "none"
  | "unknown";

/** Specifies if datetime relates to departure or arrival */
export type DateTimeRelatesTo = "departure" | "arrival";

/** Base error object */
export interface ApiError {
  /** Numeric error code */
  errorCode: number;
  /** Detailed error message */
  errorMessage?: string;
}

////////////////////////////////////
// Models (abbreviated, see full spec for all schemas)
////////////////////////////////////
export interface StopAreaApiModel {
  gid?: string;
  name?: string;
  lat: number;
  long: number;
}
export interface StopPointApiModel {
  gid: string;
  name: string;
  platform?: string;
  latitude?: number;
  longitude?: number;
  stopArea?: StopAreaApiModel;
}
export interface ServiceJourneyApiModel {
  gid: string;
  origin?: string;
  direction?: string;
  line: LineApiModel;
}
export interface LineApiModel {
  gid?: string;
  name?: string;
  shortName?: string;
  designation?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  borderColor?: string;
  transportMode: TransportMode;
  transportSubMode?: JourneyTransportSubMode;
  isWheelchairAccessible?: boolean;
}
export interface OccupancyInformationApiModel {
  level: string;
  source: string;
}
export interface ArrivalApiModel {
  detailsReference?: string;
  serviceJourney: ServiceJourneyApiModel;
  stopPoint: StopPointApiModel;
  plannedTime: string;
  estimatedTime?: string;
  estimatedOtherwisePlannedTime?: string;
  isCancelled: boolean;
  isPartCancelled: boolean;
}
export interface DepartureApiModel {
  detailsReference?: string;
  serviceJourney: ServiceJourneyApiModel;
  stopPoint: StopPointApiModel;
  plannedTime: string;
  estimatedTime?: string;
  estimatedOtherwisePlannedTime?: string;
  isCancelled: boolean;
  isPartCancelled: boolean;
  occupancy?: OccupancyInformationApiModel;
}
export interface JourneyApiModel {
  reconstructionReference?: string;
  detailsReference?: string;
  departureAccessLink?: ConnectionLinkApiModel;
  tripLegs?: TripLegApiModel[];
  connectionLinks?: ConnectionLinkApiModel[];
  arrivalAccessLink?: ConnectionLinkApiModel;
  destinationLink?: ConnectionLinkApiModel;
  isDeparted?: boolean;
  occupancy?: OccupancyInformationApiModel;
}
export interface JourneyDetailsApiModel {
  departureAccessLink?: ConnectionLinkApiModel;
  tripLegs?: TripLegDetailsApiModel[];
  connectionLinks?: ConnectionLinkApiModel[];
  arrivalAccessLink?: ConnectionLinkApiModel;
  destinationLink?: ConnectionLinkApiModel;
  ticketSuggestionsResult?: TicketSuggestionsResultApiModel;
  tariffZones?: TariffZoneApiModel[];
  occupancy?: OccupancyInformationApiModel;
}
// ... other model interfaces omitted for brevity
export interface JourneysParameters {
  originGid?: string;
  originName?: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationGid?: string;
  destinationName?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  dateTime?: string;
  dateTimeRelatesTo?: DateTimeRelatesTo;
  paginationReference?: string;
  limit?: number;
  transportModes?: TransportMode[];
  transportSubModes?: JourneyTransportSubMode[];
  onlyDirectConnections?: boolean;
  includeNearbyStopAreas?: boolean;
  viaGid?: string;
  originWalk?: string;
  destWalk?: string;
  originBike?: string;
  destBike?: string;
  totalBike?: string;
  originCar?: string;
  destCar?: string;
  originPark?: string;
  destPark?: string;
  interchangeDurationInMinutes?: number;
  useRealTimeMode?: boolean;
  includeOccupancy?: boolean;
  bodSearch?: boolean;
}
export type JourneyDetailsInclude =
  | "ticketsuggestions"
  | "triplegcoordinates"
  | "validzones"
  | "servicejourneycalls"
  | "servicejourneycoordinates"
  | "links"
  | "occupancy";

////////////////////////////////////
// Client Interface
////////////////////////////////////
/**
 * Västtrafik Planner API v4 client interface
 */
export interface VasttrafikClient {
  /** GET /stop-areas */
  stopAreas(): Promise<StopAreaApiModel[]>;
  /** GET /stop-areas/{gid}/arrivals */
  stopAreaArrivals(
    gid: string,
    params?: { includes?: string[] },
  ): Promise<ApiResponse<ArrivalApiModel>>;
  /** GET /stop-areas/{gid}/departures */
  stopAreaDepartures(
    gid: string,
    params?: { includes?: string[] },
  ): Promise<ApiResponse<DepartureApiModel>>;
  /** GET /stop-areas/{gid}/departures/{detailsReference}/details */
  stopAreaDepartureDetails(
    gid: string,
    detailsReference: string,
    params?: { includes?: string[] },
  ): Promise<DepartureApiModel>;
  /** GET /journeys */
  journeys(params: JourneysParameters): Promise<ApiResponse<JourneyApiModel>>;
  /** GET /journeys/{detailsReference}/details */
  journeyDetails(
    detailsReference: string,
    params?: {
      includes?: JourneyDetailsInclude[];
      channelIds?: number[];
      productTypes?: number[];
      travellerCategories?: string[];
    },
  ): Promise<JourneyDetailsApiModel>;
}
