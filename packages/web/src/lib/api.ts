import type {
  ApiResponse,
  ArrivalApiModel,
  JourneyDetailsApiModel,
} from '@vasttrafik-tracker/vasttrafik';

export async function stopPointArrivals(
  gid: string,
  options: { maxArrivalsPerLineAndDirection?: number } = {}
): Promise<ApiResponse<ArrivalApiModel>> {
  const qs = buildQueryParams(options);
  const response = await get(`/api/stop-points/${gid}/arrivals?${qs}`);
  return response.json();
}

export async function journeyDetails(detailsReference: string): Promise<JourneyDetailsApiModel> {
  const response = await get(`/api/journeys/${detailsReference}/details`);
  return response.json();
}

async function get(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request failed (${res.status}): ${body}`);
  }
  return res;
}

type QueryParamValue = string | number | boolean | string | number[] | boolean[] | undefined | null;

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
