export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Serve static assets as-is
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    // SPA fallback: serve index.html for all routes
    const indexRequest = new Request(new URL('/index.html', url.origin), request);
    return env.ASSETS.fetch(indexRequest);
  }
};
