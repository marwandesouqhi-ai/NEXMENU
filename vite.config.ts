import { defineConfig, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Development builds get inline sourcemaps for easier debugging.
  const emitSourcemaps = mode === 'development'
  const appTarget = (process.env.VITE_APP_TARGET || 'all').toLowerCase().trim()
  const isAdminTarget = appTarget === 'admin'

  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
  ]

  if (isAdminTarget) {
    plugins.push({
      name: 'virtual-pwa-stub',
      resolveId(id) {
        if (id === 'virtual:pwa-register') {
          return '\0virtual:pwa-register'
        }
      },
      load(id) {
        if (id === '\0virtual:pwa-register') {
          return 'export function registerSW() { return () => {}; }'
        }
      },
    })
  } else {
    plugins.push(
      VitePWA({
        registerType: 'prompt',
        devOptions: {
          enabled: true,
        },
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'NEXMENU — Digital Menus',
          short_name: 'NEXMENU',
          description: 'Your Restaurant. Your Menu. One QR.',
          theme_color: '#17221d',
          background_color: '#f6f7f4',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // Only the app shell and immutable assets are cached. Private data stays in IndexedDB.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          navigateFallbackDenylist: [/^\/dashboard/, /^\/admin/, /^\/login/, /^\/signup/],
        },
      })
    )
  }

  plugins.push(targetHardeningPlugin(appTarget))
  plugins.push(devErrorOverlayReplay())
  plugins.push(reactRefreshBoundaryFallback())

  return {
    base: process.env.VITE_BASE_URL ? `${process.env.VITE_BASE_URL}/` : '/',
    define: {
      'import.meta.env.VITE_APP_TARGET': JSON.stringify(appTarget),
    },
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins,
    resolve: {
      alias: [
        ...(appTarget === 'public'
          ? [{ find: '@/pages/AdminPage', replacement: path.resolve(__dirname, './src/app/stub.tsx') }]
          : []),
        ...(appTarget === 'admin'
          ? [
              { find: '@/pages/PublicMenuPage', replacement: path.resolve(__dirname, './src/app/stub.tsx') },
              { find: '@/pages/LandingPage', replacement: path.resolve(__dirname, './src/app/stub.tsx') },
              { find: '@/pages/DashboardPage', replacement: path.resolve(__dirname, './src/app/stub.tsx') },
              { find: '@/pages/OnboardingPage', replacement: path.resolve(__dirname, './src/app/stub.tsx') },
              { find: '@/layouts/DashboardLayout', replacement: path.resolve(__dirname, './src/app/stub.tsx') },
            ]
          : []),
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
    },
    server: {
      host: process.env.VITE_HOST || 'localhost',
      port: parseInt(process.env.PORT || '5173'),
      watch: {
        ignored: ['**/.figma/**'],
      },
    },
    preview: {
      host: process.env.VITE_HOST || 'localhost',
      port: parseInt(process.env.PREVIEW_PORT || '4173'),
    },
  }
})

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function devErrorOverlayReplay(): Plugin {
  return {
    name: 'dev-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      // biome-ignore lint/suspicious/noExplicitAny: Vite ws.send typing requires any here
      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      // biome-ignore lint/suspicious/noExplicitAny: Vite ws.send typing requires any here
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when a component file is replaced with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function reactRefreshBoundaryFallback(): Plugin {
  type ModuleNode = import('vite').ModuleNode
  const hadRefreshBoundary = new Map<string, boolean>()
  const lostRefreshBoundaries = new Set<string>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    handleHotUpdate({ modules, server, timestamp }) {
      if (lostRefreshBoundaries.size === 0) return

      const visited = new Set<ModuleNode>()
      const pending = [...modules]
      while (pending.length > 0) {
        const current = pending.pop()
        if (!current || visited.has(current)) continue
        visited.add(current)

        const moduleId = current.id?.split('?')[0]
        if (moduleId && lostRefreshBoundaries.has(moduleId)) {
          const invalidated = new Set<ModuleNode>()
          for (const updatedModule of modules) {
            server.moduleGraph.invalidateModule(updatedModule, invalidated, timestamp, true)
          }
          sendFullReload?.()
          return []
        }

        pending.push(...current.importers)
      }
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (hasRefreshBoundary) lostRefreshBoundaries.delete(moduleId)
      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        lostRefreshBoundaries.add(moduleId)
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

function targetHardeningPlugin(target: string): Plugin {
  const isAdmin = target === 'admin'
  return {
    name: 'target-hardening-plugin',
    transformIndexHtml(html) {
      if (isAdmin) {
        let transformed = html
        transformed = transformed.replace(
          /<title>.*?<\/title>/i,
          '<title>NEXMENU — System Administration</title>'
        )
        transformed = transformed.replace(
          /<\/head>/i,
          '    <meta name="robots" content="noindex,nofollow" />\n  </head>'
        )
        transformed = transformed.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, '')
        return transformed
      }
      return html
    },
    generateBundle() {
      if (isAdmin) {
        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: 'User-agent: *\nDisallow: /\n',
        })
      } else {
        const siteUrl = process.env.VITE_SITE_URL ? process.env.VITE_SITE_URL.replace(/\/+$/, '') : ''
        const sitemapLine = siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''
        const robotsContent = `# NEXMENU Robots Configuration\nUser-agent: *\nAllow: /\nAllow: /r/\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /login\nDisallow: /signup\nDisallow: /reset-password\nDisallow: /onboarding\n${sitemapLine}`
        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: robotsContent,
        })
      }
    },
  }
}
