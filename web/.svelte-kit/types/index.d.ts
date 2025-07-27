type DynamicRoutes = {
	"/api/journeys/[detailsReference]": { detailsReference: string };
	"/api/journeys/[detailsReference]/details": { detailsReference: string };
	"/api/stop-points/[gid]": { gid: string };
	"/api/stop-points/[gid]/arrivals": { gid: string }
};

type Layouts = {
	"/": { detailsReference?: string; gid?: string };
	"/api": { detailsReference?: string; gid?: string };
	"/api/journeys": { detailsReference?: string };
	"/api/journeys/[detailsReference]": { detailsReference: string };
	"/api/journeys/[detailsReference]/details": { detailsReference: string };
	"/api/stop-points": { gid?: string };
	"/api/stop-points/[gid]": { gid: string };
	"/api/stop-points/[gid]/arrivals": { gid: string }
};

export type RouteId = "/" | "/api" | "/api/journeys" | "/api/journeys/[detailsReference]" | "/api/journeys/[detailsReference]/details" | "/api/stop-points" | "/api/stop-points/[gid]" | "/api/stop-points/[gid]/arrivals";

export type RouteParams<T extends RouteId> = T extends keyof DynamicRoutes ? DynamicRoutes[T] : Record<string, never>;

export type LayoutParams<T extends RouteId> = Layouts[T] | Record<string, never>;

export type Pathname = "/" | "/api" | "/api/journeys" | `/api/journeys/${string}` & {} | `/api/journeys/${string}/details` & {} | "/api/stop-points" | `/api/stop-points/${string}` & {} | `/api/stop-points/${string}/arrivals` & {};

export type ResolvedPathname = `${"" | `/${string}`}${Pathname}`;

export type Asset = "/favicon.svg";