import {
  VASTTRAFIK_CLIENT_SECRET,
  VASTTRAFIK_CLIENT_ID,
} from "$env/static/private";

const host = "https://ext-api.vasttrafik.se";

const tokenUrl = `${host}/token`;
const plannerApi = `${host}/pr/v4/`;

export default {
  stopAreas,
};

/**
 * @typedef {Object} StopArea
 * @property {string} gid - The unique identifier for the stop area.
 * @property {string} name - The name of the stop area.
 * @property {number} lat - The latitude of the stop area.
 * @property {number} long - The longitude of the stop area.
 */

/**
 * Fetches all stop areas.
 *
 * @return {Promise<Array<StopArea>>} A promise that resolves to an array of stop areas.
 */
async function stopAreas() {
  const response = await get("stop-areas");
  if (!response.ok) {
    throw new Error(`Failed to fetch stop areas: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

/**
 * Calls the Västtrafik Planner API.
 *
 * @param {RequestInfo | URL} input - The input string to be processed.
 * @param {RequestInit} [init] - Optional initialization parameters for the request.
 * @return {Promise<Response>} A promise that resolves to the response of the request.
 */
async function get(input, init) {
  if (typeof input === "string") {
    input = new URL(input, plannerApi);
  } else if (input instanceof URL) {
    input = new URL(input, plannerApi);
  } else {
    throw new Error("Input must be a string or URL");
  }
  init = await withClientCredentials({
    clientId: VASTTRAFIK_CLIENT_ID,
    clientSecret: VASTTRAFIK_CLIENT_SECRET,
  })(init);
  return fetch(input, init);
}

/**
 * Enriches the request with client credentials for authentication.
 *
 * @param {{clientId: string, clientSecret: string}} config - Configuration object containing client ID and secret.
 * @return {(init?: RequestInit) => Promise<RequestInit>} A function that returns a RequestInit object with the Authorization header set.
 */
function withClientCredentials(config) {
  /**
   * @type {{access_token: string, expires_at: number}|null}
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
 *
 * @param {{clientId: string, clientSecret: string}} config - Configuration object containing client ID and secret.
 * @return {Promise<{access_token: string, expires_in: number}>} A promise that resolves to the access token object.
 */
async function exchangeClientCredentials(config) {
  tokenUrl;
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
