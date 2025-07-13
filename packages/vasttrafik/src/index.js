const host = "https://ext-api.vasttrafik.se";

const tokenUrl = `${host}/token`;
const plannerApi = `${host}/pr/v4/`;

/**
 * Creates a Vasttrafik API client with configurable credentials.
 * @param {import('./index').ClientCredentialsConfig} config Configuration object containing client ID and secret
 * @returns {import('./index').VasttraffikClient} The API client instance
 */
export function createClient(config) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Client ID and client secret are required");
  }

  const authManager = withClientCredentials(config);

  /**
   * Calls the Västtrafik Planner API.
   * @param {string | URL} input The input string to be processed
   * @param {object} [init] Optional initialization parameters for the request
   * @returns {Promise<Response>} A promise that resolves to the response of the request
   */
  async function get(input, init) {
    if (typeof input === "string") {
      input = new URL(input, plannerApi);
    } else if (input instanceof URL) {
      input = new URL(input, plannerApi);
    } else {
      throw new Error("Input must be a string or URL");
    }
    init = await authManager(init);
    const response = await fetch(input, init);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Request to ${input} failed with status ${response.status}: ${body}`,
      );
    }
    return response;
  }

  /**
   * Fetches journeys.
   * @param {import('./index').JourneysParameters} params The unique identifier for the stop area
   * @returns {Promise<Array<import('./index').Journey>>} A promise that resolves to an array of journeys
   */
  async function journeys(params) {
    const { originGid, destinationGid } = params;
    if (!originGid || !destinationGid) {
      throw new Error("Both originGid and destinationGid are required");
    }

    const urlParams = new URLSearchParams(params);
    const response = await get(`journeys?${urlParams.toString()}`);
    /**
     * @type {import('./index').JourneysResponse}
     */
    const data = await response.json();
    return data.results;
  }

  /**
   * Fetches details for a specific journey.
   * @param {string} detailsReference The reference ID of the journey
   * @param {import('./index').JourneyDetailsParameters} [params] Optional parameters for the request
   * @returns {Promise<import('./index').JourneyDetails>} A promise that resolves to the details of the journey
   */
  async function journeyDetails(detailsReference, params) {
    if (!detailsReference) {
      throw new Error("Journey reference is required");
    }

    const urlParams = new URLSearchParams(params || {});
    const response = await get(
      `journeys/${detailsReference}/details?${urlParams.toString()}`,
    );
    /**
     * @type {import('./index').JourneyDetails}
     */
    const data = await response.json();
    return data;
  }

  /**
   * Fetch all arrivals for a given stop area.
   * @param {string} gid The unique identifier for the stop area
   * @returns {Promise<Array<import('./index').Arrival>>} A promise that resolves to an array of arrivals
   */
  async function stopAreaArrivals(gid) {
    const response = await get(`stop-areas/${gid}/arrivals`);
    /**
     * @type {import('./index').ArrivalsResponse}
     */
    const data = await response.json();
    return data.results;
  }

  /**
   * Fetch all departures for a given stop area.
   * @param {string} gid The unique identifier for the stop area
   * @returns {Promise<Array<import('./index').Departure>>} A promise that resolves to an array of departures
   */
  async function stopAreaDepartures(gid) {
    const response = await get(`stop-areas/${gid}/departures`);
    /**
     * @type {import('./index').DeparturesResponse}
     */
    const data = await response.json();
    return data.results;
  }

  /**
   * Fetches all stop areas.
   * @returns {Promise<Array<import('./index').StopArea>>} A promise that resolves to an array of stop areas
   */
  async function stopAreas() {
    const response = await get("stop-areas");
    /**
     * @type {Array<import('./index').StopArea>}
     */
    const data = await response.json();
    return data;
  }

  return {
    stopAreas,
    stopAreaArrivals,
    stopAreaDepartures,
    journeys,
    journeyDetails,
  };
}

/**
 * Enriches the request with client credentials for authentication.
 * @param {import('./index').ClientCredentialsConfig} config Configuration object containing client ID and secret
 * @returns {(init?: object) => Promise<object>} A function that returns a RequestInit object with the Authorization header set
 */
function withClientCredentials(config) {
  /**
   * @type {import('./index').CachedToken|null}
   */
  var token = null;

  const getToken = async () => {
    if (!token || token.expires_at < Date.now()) {
      // Exchange client credentials for an access token
      return await exchangeClientCredentials(config).then((data) => ({
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in - 300) * 1000, // Subtract 5 minutes for safety
      }));
    } else {
      return token;
    }
  };

  return async (init = {}) => {
    const token = await getToken();
    init.headers = {
      ...init.headers,
      Authorization: `Bearer ${token.access_token}`,
    };
    return init;
  };
}

/**
 * Exchanges client credentials for an access token.
 * @param {import('./index').ClientCredentialsConfig} config Configuration object containing client ID and secret
 * @returns {Promise<import('./index').TokenResponse>} A promise that resolves to the access token object
 */
async function exchangeClientCredentials(config) {
  return fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Failed to exchange client credentials");
    }
    return response.json();
  });
}
