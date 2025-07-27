// @ts-nocheck
import lines from './lines.json'
import type { PageServerLoad } from './$types'

export const load = async () => {
  return {
    lines
  }
}
;null as any as PageServerLoad;