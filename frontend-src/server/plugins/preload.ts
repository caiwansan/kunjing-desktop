import { defineNitroPlugin } from 'nitropack/runtime/plugin'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import fs, { readFileSync, readdirSync, existsSync } from 'node:fs'

// Preload renderer chunk at startup to prevent cold-start race condition.
export default defineNitroPlugin((nitroApp) => {
  // BuildId Meta Fallback: intercept old buildId requests and serve latest content.
  nitroApp.hooks.hook('request', async (event) => {
    try {
      const path = (event as any).path || ''
      const match = path.match(/^\/_nuxt\/builds\/meta\/([a-f0-9-]+)\.json$/)
      if (!match) return

      const metaDir = resolve('.output', 'public', '_nuxt', 'builds', 'meta')
      if (!existsSync(metaDir)) return

      const requestedId = match[1]
      if (existsSync(resolve(metaDir, `${requestedId}.json`))) return

      // File doesn't exist → serve latest meta content
      let fallbackPath = resolve(metaDir, 'latest.json')
      if (!existsSync(fallbackPath)) {
        const files = readdirSync(metaDir).filter(f => f.endsWith('.json') && f !== 'latest.json')
        if (files.length === 0) return
        fallbackPath = resolve(metaDir, files[0])
      }

      const content = readFileSync(fallbackPath, 'utf-8')
      const fallbackId = fallbackPath.split('/').pop()!.replace('.json', '')

      // Use h3 setResponseHeader + send
      const { setResponseHeader, send } = await import('h3')
      setResponseHeader(event, 'Content-Type', 'application/json')
      setResponseHeader(event, 'X-BuildId-Fallback', `${requestedId}->${fallbackId}`)
      ;(event as any)._handled = true
      return send(event, content)
    } catch { /* silently ignore */ }
  })
  try {
    const serverDir = resolve(typeof __dirname !== 'undefined' ? __dirname : process.cwd(), '.output', 'server')
    const rendererPath = resolve(serverDir, 'chunks', 'routes', 'renderer.mjs')

    if (!fs.existsSync(rendererPath)) {
      console.warn('[Preload] Renderer not found at', rendererPath)
    } else {
      const start = Date.now()
      import(rendererPath)
        .then(() => {
          console.log(`[Preload] Renderer chunk loaded in ${Date.now() - start}ms`)
        })
        .catch((err: Error) => {
          console.warn('[Preload] Renderer chunk preload failed:', err.message)
        })
    }
  } catch (err) {
    console.warn('[Preload] Renderer preload setup failed:', String(err))
  }

  // Hook into render:response to set 404 status for unknown SPA routes.
  // In ssr:false mode, Nuxt renders the SPA shell for ANY path and returns 200.
  // We check the original request path and set 404 if it's not a known route.
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    if (!event) return
    const path = event.path || event.url || '/'

    // Skip known paths, static assets, API routes
    if (path.startsWith('/_nuxt/')) return
    if (path.startsWith('/api/')) return
    if (path.startsWith('/favicon')) return

    // Strip query string for known path matching
    const cleanPath = path.split('?')[0]

    const knownPaths = [
      '/', '/login', '/register', '/mobile', '/projects',
      '/community', '/community/new',
      '/studio', '/studio/export',
      '/user/agent', '/user/center', '/user/credits', '/user/download',
      '/user/gallery', '/user/library', '/user/membership', '/user/messages',
      '/user/profile', '/user/projects', '/user/promo', '/user/referral', '/user/storage',
    ]

    const isKnown = knownPaths.includes(cleanPath) ||
      cleanPath.startsWith('/community/') ||
      cleanPath.startsWith('/studio/') ||
      cleanPath.startsWith('/user/') ||
      cleanPath.startsWith('/admin/')

    if (!isKnown) {
      response.statusCode = 404
      response.statusMessage = 'Not Found'
    }
  })
})
