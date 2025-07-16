import { createClient } from '@vasttrafik-tracker/vasttrafik';
import { VASTTRAFIK_CLIENT_SECRET, VASTTRAFIK_CLIENT_ID } from '$env/static/private';

const client = createClient({
  clientId: VASTTRAFIK_CLIENT_ID,
  clientSecret: VASTTRAFIK_CLIENT_SECRET,
});

export default client;
