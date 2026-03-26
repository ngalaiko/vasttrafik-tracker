/** [latitude, longitude] */
export type Point = [number, number]

/** A physical stop platform. */
export interface Stop {
  gid: string
  name: string
  position: Point
}

/** A tram route in one direction (static, stored in lines.json). */
export interface Route {
  name: string
  direction: string
  colors: {
    background: string
    foreground: string
    border: string
  }
  stops: Stop[]
  coordinates: Point[]
}

/** Stop times for one stop on a live trip. */
export interface ScheduleStop {
  stop: Stop
  /** Epoch ms. */
  departure?: number
  /** Epoch ms. */
  arrival?: number
}

/** A specific vehicle run (live, assembled from API arrivals + journey details). */
export interface Trip {
  serviceJourneyGid: string
  route: Route
  coordinates: Point[]
  schedule: ScheduleStop[]
  nextStop: Stop
}

/** Scored result. */
export interface ScoredTrip {
  trip: Trip
  score: number
  diagnostics: import('$lib/signals/combine').ScoringDiagnostics
}
