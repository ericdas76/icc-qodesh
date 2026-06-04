export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    const indexRequest = new Request(new URL('/index.html', request.url), request);
    return env.ASSETS.fetch(indexRequest);
  }
}
