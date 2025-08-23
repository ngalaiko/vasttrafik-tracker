import type {
  StopPointApiModel,
  ArrivalApiModel,
  JourneyDetailsApiModel
} from '@vasttrafik-tracker/vasttrafik'
import { transitStore } from '$lib/stores/transitStore.svelte'

export function useTransitData(
  stops: StopPointApiModel[] | (() => StopPointApiModel[])
) {
  const stableArrivals = $derived(() => {
    const currentStops = typeof stops === 'function' ? stops() : stops
    // Preload stops for better performance
    transitStore.preloadStops(currentStops)
    return currentStops.map(stopPoint =>
      transitStore.getStopPointArrivals(stopPoint.gid)
    )
  })

  const stableArrivalValues = $derived(() => {
    const arrivals = stableArrivals()
    return arrivals
      .flatMap(arrivals => arrivals.value)
      .filter(arrival => arrival.serviceJourney.line.transportMode === 'tram')
      .filter(
        (arrival, i, arrivals) =>
          arrivals.findIndex(
            a => a.detailsReference === arrival.detailsReference
          ) === i
      )
  })

  const stableJourneyDetails = $derived(() => {
    const arrivalValues = stableArrivalValues()
    return arrivalValues.map(arrival =>
      transitStore.getJourneyDetails(arrival.detailsReference)
    )
  })

  const journeyDetailsValues = $derived(() => {
    const journeyDetails = stableJourneyDetails()
    return journeyDetails
      .flatMap(details => details.value)
      .filter((details): details is JourneyDetailsApiModel => details !== null)
  })

  const arrivalJourneys = $derived(() => {
    const arrivalValues = stableArrivalValues()
    const journeyValues = journeyDetailsValues()
    return arrivalValues
      .map(arrival => {
        const journeyDetails = journeyValues.find(sj =>
          sj.tripLegs.some(leg =>
            leg.serviceJourneys.some(
              sj => sj.gid === arrival.serviceJourney.gid
            )
          )
        )
        return {
          arrival,
          journeyDetails
        }
      })
      .filter(
        (
          aj
        ): aj is {
          arrival: ArrivalApiModel
          journeyDetails: JourneyDetailsApiModel
        } => aj.journeyDetails !== undefined
      )
  })

  return {
    get arrivals() {
      return stableArrivals()
    },
    get arrivalValues() {
      return stableArrivalValues()
    },
    get journeyDetails() {
      return stableJourneyDetails()
    },
    get arrivalJourneys() {
      return arrivalJourneys()
    }
  }
}
