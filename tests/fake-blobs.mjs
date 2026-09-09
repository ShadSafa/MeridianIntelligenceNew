// In-memory stand-in for @netlify/blobs so the function handlers can be
// exercised without a deployed site.
//
// Caveat worth remembering: this fake is always strongly consistent. Real
// Netlify Blobs defaults to *eventual* consistency, which once let a broken
// rate limiter pass these tests while doing nothing in production. The
// functions now ask for `consistency: 'strong'` explicitly; this fake cannot
// catch a regression on that, so it is asserted below instead.

const stores = new Map();

export const requestedOptions = [];

export function getStore(nameOrOptions) {
  const options = typeof nameOrOptions === 'string' ? { name: nameOrOptions } : nameOrOptions;
  requestedOptions.push(options);

  if (!stores.has(options.name)) stores.set(options.name, new Map());
  const data = stores.get(options.name);

  return {
    async get(key) {
      return data.has(key) ? JSON.parse(data.get(key)) : null;
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async list() {
      return { blobs: Array.from(data.keys()).map((key) => ({ key })) };
    }
  };
}
