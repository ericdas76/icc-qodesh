export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Serve static assets directly
    try {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    } catch {}
    // SPA fallback: serve index.html for all non-asset routes
    const indexRequest = new Request(new URL('/index.html', request.url), request);
    return env.ASSETS.fetch(indexRequest);
  }
};
