// Shows the name or ID of private channels

import { TautPlugin, type TautPluginConfig, type TautAPI } from '$taut'

const CID_API_URL = 'https://flaron.halceon.dev/cid'
const CID_CACHE_KEY = 'slack_private_channel_names_v1'
const CID_CACHE_TIMESTAMP_KEY = 'slack_private_channel_names_timestamp_v1'
const CID_CACHE_DURATION = 24 * 60 * 60 * 1000
const MAX_CACHE_SIZE = 5000

// null means we looked it up and there is no name available
type ChannelName = string | null
let nameCache: Record<string, ChannelName> = {}

// Pending fetch promises to prevent duplicate requests
const pendingFetches = new Map<string, Promise<ChannelName>>()

export default class PrivateChannel extends TautPlugin {
  static readonly pluginName = 'Private Channel'
  static readonly description = 'Shows the name or ID of private channels'
  static readonly defaultConfig = `
    // Shows the name or ID of private channels
    "PrivateChannel": {
      "enabled": true
    }
  `
  static readonly authors = '<@U06UYA5GMB5>'

  unpatchBaseMrkdwnChannel = () => {}

  start() {
    this.log('Started')

    this.loadNameCache()

    const instance = this

    const SvgIcon = this.api.findComponent<{
      inline: boolean
      name: string
    }>('SvgIcon')

    this.unpatchBaseMrkdwnChannel = this.api.patchComponent<{
      isNonExistent: boolean
      id: string
    }>('BaseMrkdwnChannel', (OriginalBaseMrkdwnChannel) => (props) => {
      if (props.isNonExistent) {
        const id = props.id

        const [name, setName] = React.useState<ChannelName>(() =>
          id in nameCache ? nameCache[id] : null
        )

        React.useEffect(() => {
          if (!id) return
          if (id in nameCache) {
            if (name !== nameCache[id]) setName(nameCache[id])
            return
          }
          instance.fetchChannelName(id).then((fetchedName) => {
            setName(fetchedName)
          })
        }, [id])

        return (
          <span className="c-missing_channel--private">
            <SvgIcon inline={true} name="lock" />
            {name ?? id}
          </span>
        )
      }
      return <OriginalBaseMrkdwnChannel {...props} />
    })
  }

  stop() {
    this.unpatchBaseMrkdwnChannel()
    this.log('Stopped')
  }

  loadNameCache(): void {
    try {
      const timestamp = localStorage.getItem(CID_CACHE_TIMESTAMP_KEY)
      if (
        timestamp &&
        Date.now() - parseInt(timestamp, 10) < CID_CACHE_DURATION
      ) {
        const cached = localStorage.getItem(CID_CACHE_KEY)
        if (cached) {
          nameCache = JSON.parse(cached)
          this.log(
            'Loaded channel name cache:',
            Object.keys(nameCache).length,
            'channels'
          )
        }
      }
    } catch (e) {
      this.log('Error loading channel name cache:', e)
    }
  }

  saveNameCache(): void {
    try {
      localStorage.setItem(CID_CACHE_KEY, JSON.stringify(nameCache))
      localStorage.setItem(CID_CACHE_TIMESTAMP_KEY, Date.now().toString())
    } catch (e) {
      this.log('Error saving channel name cache:', e)
    }
  }

  setCache(id: string, name: ChannelName): void {
    nameCache[id] = name

    const keys = Object.keys(nameCache)
    if (keys.length > MAX_CACHE_SIZE) {
      const toRemove = keys.slice(0, 100)
      toRemove.forEach((k) => delete nameCache[k])
    }

    this.saveNameCache()
  }

  async fetchChannelName(id: string): Promise<ChannelName> {
    if (id in nameCache) {
      return nameCache[id]
    }

    if (pendingFetches.has(id)) {
      return pendingFetches.get(id)!
    }

    const fetchPromise = (async (): Promise<ChannelName> => {
      try {
        const response = await fetch(`${CID_API_URL}/${id}`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        const name: ChannelName =
          typeof data.name === 'string' ? data.name : null

        this.setCache(id, name)
        return name
      } catch (e) {
        this.log('Error fetching channel name:', e)
        return null // Do not cache errors
      } finally {
        pendingFetches.delete(id)
      }
    })()

    pendingFetches.set(id, fetchPromise)
    return fetchPromise
  }
}
