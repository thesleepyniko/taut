interface Env {
  ASSETS: Fetcher
}

const GH = 'https://github.com/jeremy46231/taut/releases/download'

const REDIRECTS: Record<string, string> = {
  '/taut.js': `${GH}/latest/taut.js`,
  '/taut.debug.js': `${GH}/latest/taut.debug.js`,
  '/taut.user.js': `${GH}/latest/taut.user.js`,
  '/taut-chrome.zip': `${GH}/latest/taut-chrome.zip`,
  '/taut-firefox.zip': `${GH}/latest/taut-firefox.zip`,
  '/taut-mac.dmg': `${GH}/latest/taut-mac.dmg`,
  '/taut-win.exe': `${GH}/latest/taut-win.exe`,
  '/taut-linux.AppImage': `${GH}/latest/taut-linux.AppImage`,
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/') {
      return Response.redirect('https://github.com/jeremy46231/taut', 302)
    }

    const redirect = REDIRECTS[url.pathname]
    if (redirect) {
      return Response.redirect(redirect, 302)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
