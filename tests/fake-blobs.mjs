// In-memory stand-in for @netlify/blobs so the function handlers can be
// exercised without a deployed site.

const stores = new Map();

export function getStore(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const data = stores.get(name);

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
