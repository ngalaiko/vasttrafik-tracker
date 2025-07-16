import lines from './lines.json';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    lines,
  };
};
