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
  | 'tram'
  | 'bus'
  | 'ferry'
  | 'train'
  | 'taxi'
  | 'walk'
  | 'bike'
  | 'car'
  | 'none'
  | 'unknown'
  | 'teletaxi';

export type DateTimeRelatesTo = 'departure' | 'arrival';

export interface ApiError {
  errorCode: number;
  errorMessage?: string;
}

export interface StopAreaApiModel {
  gid: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface StopPointApiModel {
  gid: string;
  name: string;
  platform: string;
  latitude: number;
  longitude: number;
  stopArea: StopAreaApiModel;
}

export interface LineApiModel {
  name: string;
  shortName: string;
  designation: string;
  backgroundColor: string;
  foregroundColor: string;
  borderColor: string;
  transportMode: TransportMode;
}

export interface ServiceJourneyApiModel {
  gid: string;
  origin?: string;
  direction?: string;
  line: LineApiModel;
}

export interface ArrivalApiModel {
  detailsReference: string;
  serviceJourney: ServiceJourneyApiModel;
  stopPoint: StopPointApiModel;
  estimatedOtherwisePlannedTime: string;
  isCancelled: boolean;
  isPartCancelled: boolean;
}

export interface DepartureApiModel {
  detailsReference: string;
  serviceJourney: ServiceJourneyApiModel;
  stopPoint: StopPointApiModel;
  estimatedOtherwisePlannedTime: string;
  isCancelled: boolean;
  isPartCancelled: boolean;
}

export interface CallApiModel {
  stopPoint: StopPointApiModel;
  estimatedOtherwisePlannedDepartureTime?: string;
  estimatedOtherwisePlannedArrivalTime?: string;
}

export interface ServiceJourneyDetailsApiModel {
  gid: string;
  line: LineApiModel;
  serviceJourneyCoordinates?: Array<{ latitude: number; longitude: number }>;
  callsOnServiceJourney?: CallApiModel[];
}

export interface DepartureDetailsApiModel {
  serviceJourneys: ServiceJourneyDetailsApiModel[];
}

export interface TripLegDetailsApiModel {
  callsOnTripLeg: CallApiModel[];
}

export interface JourneyDetailsApiModel {
  tripLegs: TripLegDetailsApiModel[];
}

const host = 'https://ext-api.vasttrafik.se';
const tokenUrl = `${host}/token`;
const plannerApi = `${host}/pr/v4/`;

type QueryParamValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | undefined
  | null;

function buildQueryParams(params: Record<string, QueryParamValue> | object): URLSearchParams {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, String(v)));
    } else if (typeof value === 'boolean') {
      qs.append(key, value ? '1' : '0');
    } else {
      qs.append(key, String(value));
    }
  });
  return qs;
}

async function exchangeClientCredentials(config: {
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
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

export function createClient(config: { clientId: string; clientSecret: string }) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Client ID and secret are required');
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
      const res = await get('stop-areas');
      return res.json();
    },

    async stopAreaArrivals(
      gid: string,
      params: { includes?: ('servicejourneycoordinates' | 'servicejourneycalls')[] } = {}
    ): Promise<ApiResponse<ArrivalApiModel>> {
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/arrivals?${qs}`);
      return res.json();
    },

    async stopAreaDepartures(
      gid: string,
      params: { includes?: ('servicejourneycoordinates' | 'servicejourneycalls')[] } = {}
    ): Promise<ApiResponse<DepartureApiModel>> {
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/departures?${qs}`);
      return res.json();
    },

    async stopAreaDepartureDetails(
      gid: string,
      detailsReference: string,
      params: { includes?: ('servicejourneycoordinates' | 'servicejourneycalls')[] } = {}
    ): Promise<DepartureDetailsApiModel> {
      if (!gid || !detailsReference) throw new Error('Both gid and detailsReference are required');
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/departures/${detailsReference}/details?${qs}`);
      return res.json();
    },

    async journeyDetails(detailsReference: string): Promise<JourneyDetailsApiModel> {
      if (!detailsReference) throw new Error('detailsReference is required');
      const res = await get(`journeys/${detailsReference}/details`);
      return res.json();
    },

    async stopPointArrivals(
      gid: string,
      params: { maxArrivalsPerLineAndDirection?: number } = {}
    ): Promise<ApiResponse<ArrivalApiModel>> {
      if (!gid) throw new Error('gid is required');
      const qs = buildQueryParams(params);
      const res = await get(`stop-points/${gid}/arrivals?${qs}`);
      return res.json();
    },
  };
}
