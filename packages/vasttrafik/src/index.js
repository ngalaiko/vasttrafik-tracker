/**
 * @typedef {import('./index.d.ts').TokenResponse} TokenResponse
 * @typedef {import('./index.d.ts').PaginationProperties} PaginationProperties
 * @typedef {import('./index.d.ts').PaginationLinks} PaginationLinks
 * @typedef {import('./index.d.ts').ApiResponse} ApiResponse
 * @typedef {import('./index.d.ts').StopAreaApiModel} StopAreaApiModel
 * @typedef {import('./index.d.ts').ArrivalApiModel} ArrivalApiModel
 * @typedef {import('./index.d.ts').DepartureApiModel} DepartureApiModel
 * @typedef {import('./index.d.ts').JourneyApiModel} JourneyApiModel
 * @typedef {import('./index.d.ts').JourneyDetailsApiModel} JourneyDetailsApiModel
 * @typedef {import('./index.d.ts').JourneysParameters} JourneysParameters
 * @typedef {import('./index.d.ts').JourneyDetailsInclude} JourneyDetailsInclude
 * @typedef {import('./index.d.ts').VasttrafikClient} VasttrafikClient
 */

/** @module vasttrafik-client */

const host = "https://ext-api.vasttrafik.se";
const tokenUrl = `${host}/token`;
const plannerApi = `${host}/pr/v4/`;

/**
 * Build URLSearchParams from an object.
 * @param {{ [key: string]: any }} params - Key/value pairs to encode.
 * @returns {URLSearchParams} - URL-encoded query parameters.
 */
function buildQueryParams(params) {
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

/**
 * Exchange client credentials for an OAuth2 token.
 * @param {{ clientId: string; clientSecret: string }} config - OAuth2 credentials.
 * @returns {Promise<TokenResponse>} - Promise resolving to token info.
 */
async function exchangeClientCredentials(config) {
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
  return /** @type {Promise<TokenResponse>} */ (res.json());
}

/**
 * Create auth middleware for OAuth2 client credentials flow.
 * @param {{ clientId: string; clientSecret: string }} config - OAuth2 credentials.
 * @returns {function(object=): Promise<object>} - Function to apply Authorization header.
 */
function withClientCredentials(config) {
  /** @type {{ access_token: string; expires_at: number } | null} */
  let token = null;

  /**
   * Fetch or return valid OAuth2 token.
   * @returns {Promise<{ access_token: string; expires_at: number }>} - Token object.
   */
  async function fetchToken() {
    if (!token || token.expires_at < Date.now()) {
      const data = await exchangeClientCredentials(config);
      token = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in - 300) * 1000,
      };
    }
    return token;
  }

  /**
   * Apply OAuth2 access token header to a fetch init.
   * @param {object} init - Original fetch init options.
   * @returns {Promise<object>} - Init with Authorization header.
   */
  return async function applyAuth(init) {
    const tk = await fetchToken();
    init.headers = {
      ...(init.headers || {}),
      Authorization: `Bearer ${tk.access_token}`,
    };
    return init;
  };
}

/**
 * Create a Västtrafik Planner API client.
 * @param {{ clientId: string; clientSecret: string }} config - Client credentials.
 * @returns {VasttrafikClient} - Instance of API client.
 */
export function createClient(config) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Client ID and secret are required");
  }
  const auth = withClientCredentials(config);

  /**
   * Internal GET request helper.
   * @param {string} path - API path relative to base.
   * @param {object} [init] - Fetch init options.
   * @returns {Promise<Response>} - Fetch response object.
   */
  async function get(path, init) {
    const url = new URL(path, plannerApi).toString();
    const authInit = await auth(init || {});
    const res = await fetch(url, authInit);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Request failed (${res.status}): ${body}`);
    }
    return res;
  }

  return /** @type {VasttrafikClient} */ ({
    /**
     * Fetch all stop areas.
     * @returns {Promise<StopAreaApiModel[]>} - Array of stop areas.
     */
    async stopAreas() {
      const res = await get("stop-areas");
      return /** @type {Promise<StopAreaApiModel[]>} */ (res.json());
    },

    /**
     * Fetch arrivals for a stop area.
     * @param {string} gid - Stop area GID.
     * @param {{ includes?: string[] }} [params] - Query includes.
     * @returns {Promise<ApiResponse<ArrivalApiModel>>} - Arrivals response.
     */
    async stopAreaArrivals(gid, params = {}) {
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/arrivals?${qs}`);
      return /** @type {Promise<ApiResponse<ArrivalApiModel>>} */ (res.json());
    },

    /**
     * Fetch departures for a stop area.
     * @param {string} gid - Stop area GID.
     * @param {{ includes?: string[] }} [params] - Query includes.
     * @returns {Promise<ApiResponse<DepartureApiModel>>} - Departures response.
     */
    async stopAreaDepartures(gid, params = {}) {
      const qs = buildQueryParams(params);
      const res = await get(`stop-areas/${gid}/departures?${qs}`);
      return /** @type {Promise<ApiResponse<DepartureApiModel>>} */ (
        res.json()
      );
    },

    /**
     * Fetch departure details.
     * @param {string} gid - Stop area GID.
     * @param {string} detailsReference - Reference ID.
     * @param {{ includes?: string[] }} [params] - Query includes.
     * @returns {Promise<DepartureApiModel>} - Detailed departure info.
     */
    async stopAreaDepartureDetails(gid, detailsReference, params = {}) {
      if (!gid || !detailsReference)
        throw new Error("Both gid and detailsReference are required");
      const qs = buildQueryParams(params);
      const res = await get(
        `stop-areas/${gid}/departures/${detailsReference}/details?${qs}`,
      );
      return /** @type {Promise<DepartureApiModel>} */ (res.json());
    },

    /**
     * Search journeys.
     * @param {JourneysParameters} params - Journey search parameters.
     * @returns {Promise<ApiResponse<JourneyApiModel>>} - Journey search results.
     */
    async journeys(params) {
      if (!params.originGid || !params.destinationGid)
        throw new Error("originGid and destinationGid are required");
      const qs = buildQueryParams(params);
      const res = await get(`journeys?${qs}`);
      return /** @type {Promise<ApiResponse<JourneyApiModel>>} */ (res.json());
    },

    /**
     * Get journey details.
     * @param {string} detailsReference - Journey details reference.
     * @param {{ includes?: JourneyDetailsInclude[]; channelIds?: number[]; productTypes?: number[]; travellerCategories?: string[] }} [params] - Include options.
     * @returns {Promise<JourneyDetailsApiModel>} - Detailed journey info.
     */
    async journeyDetails(detailsReference, params = {}) {
      if (!detailsReference) throw new Error("detailsReference is required");
      const qs = buildQueryParams(params);
      const res = await get(`journeys/${detailsReference}/details?${qs}`);
      return /** @type {Promise<JourneyDetailsApiModel>} */ (res.json());
    },

    /**
     * Fetch departures for a specific stop point.
     * @param {string} gid - Stop point GID.
     * @param {{ includes?: string[] }} [params] - Query includes.
     * @returns {Promise<ApiResponse<DepartureApiModel>>} - Departures response.
     */
    async stopPointDepartures(gid, params = {}) {
      if (!gid) throw new Error("gid is required");
      const qs = buildQueryParams(params);
      const res = await get(`stop-points/${gid}/departures?${qs}`);
      return /** @type {Promise<ApiResponse<DepartureApiModel>>} */ (
        res.json()
      );
    },

    /**
     * Fetch arrivals for a specific stop point.
     * @param {string} gid - Stop point GID.
     * @param {{ includes?: string[] }} [params] - Query includes.
     * @returns {Promise<ApiResponse<ArrivalApiModel>>} - Arrivals response.
     */
    async stopPointArrivals(gid, params = {}) {
      if (!gid) throw new Error("gid is required");
      const qs = buildQueryParams(params);
      const res = await get(`stop-points/${gid}/arrivals?${qs}`);
      return /** @type {Promise<ApiResponse<ArrivalApiModel>>} */ (res.json());
    },
  });
}
