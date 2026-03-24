// ---- App-level types (simplified, only fields we use) ----

export interface StopArea {
  gid: string
  name: string
}

export interface StopPoint {
  gid: string
  name: string
  latitude: number
  longitude: number
}

export interface Coordinate {
  latitude: number
  longitude: number
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
  | 'teletaxi'

export interface Line {
  name: string
  backgroundColor: string
  foregroundColor: string
  borderColor: string
  transportMode: TransportMode
}

export interface ServiceJourney {
  gid: string
  line: Line
}

export interface Arrival {
  detailsReference: string
  serviceJourney: ServiceJourney
  stopPoint: StopPoint
}

export interface Departure {
  detailsReference: string
  serviceJourney: ServiceJourney
}

export interface Call {
  stopPoint: StopPoint
  estimatedOtherwisePlannedDepartureTime?: string
  estimatedOtherwisePlannedArrivalTime?: string
}

export interface PaginatedResponse<T> {
  results: T[] | null
}

// ---- Departure details (used by download-lines.ts) ----

export interface ServiceJourneyDetails {
  gid: string
  line: Line
  serviceJourneyCoordinates?: Coordinate[]
  callsOnServiceJourney?: Call[]
}

export interface DepartureDetails {
  serviceJourneys: ServiceJourneyDetails[]
}

// ---- Journey details (used by web app) ----

export interface TripLeg {
  callsOnTripLeg?: Call[]
  tripLegCoordinates?: Coordinate[]
  serviceJourneys: Array<{ gid: string }>
}

export interface JourneyDetails {
  tripLegs: TripLeg[]
}

// ---- Client ----

const host = 'https://ext-api.vasttrafik.se'
const tokenUrl = `${host}/token`
const plannerApi = `${host}/pr/v4/`

type QueryParamValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | undefined
  | null

function buildQueryParams(
  params: Record<string, QueryParamValue> | object
): URLSearchParams {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach(v => qs.append(key, String(v)))
    } else if (typeof value === 'boolean') {
      qs.append(key, value ? '1' : '0')
    } else {
      qs.append(key, String(value))
    }
  })
  return qs
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

async function exchangeClientCredentials(config: {
  clientId: string
  clientSecret: string
}): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials'
    })
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  return res.json() as Promise<TokenResponse>
}

function withClientCredentials(config: {
  clientId: string
  clientSecret: string
}) {
  let token: { access_token: string; expires_at: number } | null = null

  async function fetchToken(): Promise<{
    access_token: string
    expires_at: number
  }> {
    if (!token || token.expires_at < Date.now()) {
      const data = await exchangeClientCredentials(config)
      token = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in - 300) * 1000
      }
    }
    return token
  }

  return async function applyAuth(init: RequestInit): Promise<RequestInit> {
    const tk = await fetchToken()
    init.headers = {
      ...(init.headers || {}),
      Authorization: `Bearer ${tk.access_token}`
    }
    return init
  }
}

export function createClient(config: {
  clientId: string
  clientSecret: string
}) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Client ID and secret are required')
  }
  const auth = withClientCredentials(config)

  async function get(path: string, init?: RequestInit): Promise<Response> {
    const url = new URL(path, plannerApi).toString()
    const authInit = await auth(init || {})
    const res = await fetch(url, authInit)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Request failed (${res.status}): ${body}`)
    }
    return res
  }

  return {
    async stopAreas(): Promise<StopArea[]> {
      const res = await get('stop-areas')
      // API returns { gid, name, lat, long } — map to our types
      const raw: Array<{ gid: string; name: string; lat: number; long: number }> =
        await res.json()
      return raw.map(a => ({ gid: a.gid, name: a.name }))
    },

    async stopAreaArrivals(
      gid: string,
      params: {
        includes?: ('servicejourneycoordinates' | 'servicejourneycalls')[]
      } = {}
    ): Promise<PaginatedResponse<Arrival>> {
      const qs = buildQueryParams(params)
      const res = await get(`stop-areas/${gid}/arrivals?${qs}`)
      return res.json()
    },

    async stopAreaDepartures(
      gid: string,
      params: {
        includes?: ('servicejourneycoordinates' | 'servicejourneycalls')[]
      } = {}
    ): Promise<PaginatedResponse<Departure>> {
      const qs = buildQueryParams(params)
      const res = await get(`stop-areas/${gid}/departures?${qs}`)
      return res.json()
    },

    async stopAreaDepartureDetails(
      gid: string,
      detailsReference: string,
      params: {
        includes?: ('servicejourneycoordinates' | 'servicejourneycalls')[]
      } = {}
    ): Promise<DepartureDetails> {
      if (!gid || !detailsReference)
        throw new Error('Both gid and detailsReference are required')
      const qs = buildQueryParams(params)
      const res = await get(
        `stop-areas/${gid}/departures/${detailsReference}/details?${qs}`
      )
      return res.json()
    },

    async journeyDetails(
      detailsReference: string,
      params: {
        includes?: 'triplegcoordinates'[]
      } = {}
    ): Promise<JourneyDetails> {
      if (!detailsReference) throw new Error('detailsReference is required')
      const qs = buildQueryParams(params)
      const res = await get(`journeys/${detailsReference}/details?${qs}`)
      return res.json()
    },

    async stopPointArrivals(
      gid: string,
      params: { maxArrivalsPerLineAndDirection?: number } = {}
    ): Promise<PaginatedResponse<Arrival>> {
      if (!gid) throw new Error('gid is required')
      const qs = buildQueryParams(params)
      const res = await get(`stop-points/${gid}/arrivals?${qs}`)
      return res.json()
    }
  }
}
