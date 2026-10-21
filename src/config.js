/**
 * Centralised API base URL configuration.
 *
 * Resolution order:
 *  1. `VITE_API_URL` set to an absolute URL  -> used verbatim (e.g. http://localhost:5000)
 *  2. `VITE_API_URL` set to "/" (or empty)   -> same-origin relative URLs.
 *     This is what the Docker image uses: nginx serves the SPA and reverse-proxies
 *     /api/* to the backend container, so the browser never needs to know the
 *     internal container hostname or port.
 *  3. `VITE_API_URL` not defined at all       -> local development fallback.
 */
const configuredBase = import.meta.env.VITE_API_URL;

export const API_BASE =
  configuredBase === undefined || configuredBase === null
    ? 'http://localhost:5000'
    : String(configuredBase).replace(/\/+$/, '');

export default API_BASE;
