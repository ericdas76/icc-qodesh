export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    try {
      const asset = await env.ASSETS.fetch(request)
      if (asset.status !== 404) return asset
    } catch {}
    const indexUrl = new URL('/', url.origin)
    return env.ASSETS.fetch(new Request(indexUrl.toString(), request))
  }
}
