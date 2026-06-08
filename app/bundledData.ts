declare const __TAUT_BUNDLED_PLUGINS__: Record<string, string>
declare const __TAUT_VERSION__: string

export const bundledPlugins: Record<string, string> = __TAUT_BUNDLED_PLUGINS__
export const tautVersion: string = __TAUT_VERSION__

export const emptyConfig = `{
  // Taut Plugin Configuration
  // Edit this file to configure your plugins

  "plugins": {
  }
}`

export const defaultUserCss = `/*
Add your custom CSS here to style Slack.
This file is hot-reloaded, changes apply on save!
*/

`
