import NodeCache from 'node-cache';

/**
 * Shared In-Memory Cache Instance (Practical 9: Server-Side Caching)
 * 
 * - stdTTL: 60 seconds default Time-To-Live
 * - checkperiod: 120 seconds background cleanup interval for expired keys
 */
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false // performance optimization: avoid unnecessary deep clones
});

export default cache;
