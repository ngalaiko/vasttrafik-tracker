// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

declare module '$env/static/private' {
  export const VASTTRAFIK_CLIENT_SECRET: string;
  export const VASTTRAFIK_CLIENT_ID: string;
}

export {};
