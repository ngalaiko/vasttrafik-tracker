export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface PaginationProperties {
  limit: number;
  offset: number;
  size: number;
}

export interface PaginationLinks {
  previous: string | null;
  next: string | null;
  current: string | null;
}

export interface ApiResponse<T> {
  results: T[] | null;
  pagination: PaginationProperties;
  links: PaginationLinks;
}

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

export type JourneyTransportSubMode =
  | "vasttagen"
  | "longdistancetrain"
  | "regionaltrain"
  | "flygbussarna"
  | "none"
  | "unknown";

export type DateTimeRelatesTo = "departure" | "arrival";

export interface ApiError {
  errorCode: number;
  errorMessage?: string;
}

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

export interface ServiceJourneyApiModel {
  gid: string;
  origin?: string;
  direction?: string;
  line: LineApiModel;
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

export interface ServiceJourneyDetailsApiModel {
  gid?: string;
  direction?: string;
  line?: LineApiModel;
  serviceJourneyCoordinates?: Array<{ latitude: number; longitude: number }>;
  callsOnServiceJourney?: Array<{
    stopPoint: StopPointApiModel;
    plannedArrivalTime?: string;
    plannedDepartureTime?: string;
    estimatedArrivalTime?: string;
    estimatedDepartureTime?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

export interface DepartureDetailsApiModel {
  serviceJourneys?: ServiceJourneyDetailsApiModel[];
  occupancy?: OccupancyInformationApiModel;
}

export type ConnectionLinkApiModel = Record<string, unknown>;

export type TripLegApiModel = Record<string, unknown>;

export type TripLegDetailsApiModel = Record<string, unknown>;

export type TicketSuggestionsResultApiModel = Record<string, unknown>;

export type TariffZoneApiModel = Record<string, unknown>;

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

export interface VasttrafikClient {
  stopAreas(): Promise<StopAreaApiModel[]>;
  stopAreaArrivals(
    gid: string,
    params?: { includes?: string[] },
  ): Promise<ApiResponse<ArrivalApiModel>>;
  stopAreaDepartures(
    gid: string,
    params?: { includes?: string[] },
  ): Promise<ApiResponse<DepartureApiModel>>;
  stopAreaDepartureDetails(
    gid: string,
    detailsReference: string,
    params?: { includes?: string[] },
  ): Promise<DepartureDetailsApiModel>;
  journeys(params: JourneysParameters): Promise<ApiResponse<JourneyApiModel>>;
  journeyDetails(
    detailsReference: string,
    params?: {
      includes?: JourneyDetailsInclude[];
      channelIds?: number[];
      productTypes?: number[];
      travellerCategories?: string[];
    },
  ): Promise<JourneyDetailsApiModel>;
  stopPointDepartures(gid: string, params?: { includes?: string[] }): Promise<ApiResponse<DepartureApiModel>>;
  stopPointArrivals(gid: string, params?: { includes?: string[] }): Promise<ApiResponse<ArrivalApiModel>>;
}

const host = "https://ext-api.vasttrafik.se";
const tokenUrl = `${host}/token`;
const plannerApi = `${host}/pr/v4/`;

type QueryParamValue = string | number | boolean | string[] | number[] | boolean[] | undefined | null;

function buildQueryParams(params: Record<string, QueryParamValue> | object): URLSearchParams {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, String(v)));
    } else if (typeof value === "boolean") {
      qs.append(key, value ? "1" : "0");
    } else {
      qs.append(key, String(value));
    }
  });
  return qs;
}

async function exchangeClientCredentials(config: { clientId: string; clientSecret: string }): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  return res.json() as Promise<TokenResponse>;
}

function withClientCredentials(config: { clientId: string; clientSecret: string }) {
  let token: { access_token: string; expires_at: number } | null = null;

  async function fetchToken(): Promise<{ access_token: string; expires_at: number }> {
    if (!token || token.expires_at < Date.now()) {
      const data = await exchangeClientCredentials(config);
      token = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in - 300) * 1000,
      };
    }
    return token;
  }

  return async function applyAuth(init: RequestInit): Promise<RequestInit> {
    const tk = await fetchToken();
    init.headers = {
      ...(init.headers || {}),
      Authorization: `Bearer ${tk.access_token}`,
    };
    return init;
  };
}

export function createClient(config: { clientId: string; clientSecret: string }): VasttrafikClient {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Client ID and secret are required");
  }
  const auth = withClientCredentials(config);

  async function get(path: string, init?: RequestInit): Promise<Response> {
    const url = new URL(path, plannerApi).toString();
    const authInit = await auth(init || {});
    const res = await fetch(url, authInit);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Request failed (${res.status}): ${body}`);
    }
    return res;
  }

  return {
    async stopAreas(): Promise<StopAreaApiModel[]> {
      const res = await get("stop-areas");
      return res.json() as Promise<StopAreaApiModel[]>;
    },

    async stopAreaArrivals(gid: string, params: { includes?: string[] } = {}): Promise<ApiResponse<ArrivalApiModel>> {
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/arrivals?${qs}`);
      return res.json() as Promise<ApiResponse<ArrivalApiModel>>;
    },

    async stopAreaDepartures(gid: string, params: { includes?: string[] } = {}): Promise<ApiResponse<DepartureApiModel>> {
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/departures?${qs}`);
      return res.json() as Promise<ApiResponse<DepartureApiModel>>;
    },

    async stopAreaDepartureDetails(gid: string, detailsReference: string, params: { includes?: string[] } = {}): Promise<DepartureDetailsApiModel> {
      if (!gid || !detailsReference)
        throw new Error("Both gid and detailsReference are required");
      const qs = buildQueryParams(params);
      const res = await get(
        `stop-areas/${gid}/departures/${detailsReference}/details?${qs}`,
      );
      return res.json() as Promise<DepartureDetailsApiModel>;
    },

    async journeys(params: JourneysParameters): Promise<ApiResponse<JourneyApiModel>> {
      if (!params.originGid || !params.destinationGid)
        throw new Error("originGid and destinationGid are required");
      const qs = buildQueryParams(params);
      const res = await get(`journeys?${qs}`);
      return res.json() as Promise<ApiResponse<JourneyApiModel>>;
    },

    async journeyDetails(detailsReference: string, params: {
      includes?: JourneyDetailsInclude[];
      channelIds?: number[];
      productTypes?: number[];
      travellerCategories?: string[];
    } = {}): Promise<JourneyDetailsApiModel> {
      if (!detailsReference) throw new Error("detailsReference is required");
      const qs = buildQueryParams(params);
      const res = await get(`journeys/${detailsReference}/details?${qs}`);
      return res.json() as Promise<JourneyDetailsApiModel>;
    },

    async stopPointDepartures(gid: string, params: { includes?: string[] } = {}): Promise<ApiResponse<DepartureApiModel>> {
      if (!gid) throw new Error("gid is required");
      const qs = buildQueryParams(params);
      const res = await get(`stop-points/${gid}/departures?${qs}`);
      return res.json() as Promise<ApiResponse<DepartureApiModel>>;
    },

    async stopPointArrivals(gid: string, params: { includes?: string[] } = {}): Promise<ApiResponse<ArrivalApiModel>> {
      if (!gid) throw new Error("gid is required");
      const qs = buildQueryParams(params);
      const res = await get(`stop-points/${gid}/arrivals?${qs}`);
      return res.json() as Promise<ApiResponse<ArrivalApiModel>>;
    },
  } as VasttrafikClient;
}
