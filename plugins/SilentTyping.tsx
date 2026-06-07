// Suppresses typing indicators so others can't see when you're typing

import { TautPlugin } from '$taut'

export default class SilentTyping extends TautPlugin {
  static readonly pluginName = 'Silent Typing'
  static readonly description =
    "Adds a button to suppress typing indicators so others can't see when you're typing"
  static readonly authors = '<@U080A3QP42C>, <@U06UYA5GMB5>'
  static readonly defaultConfig = `
    // Adds a button to suppress typing indicators so others can't see when you're typing
    "SilentTyping": {
      "enabled": true
    }
  `

  private suppressed = false
  private readonly listeners = new Set<(v: boolean) => void>()
  private originalSend: typeof WebSocket.prototype.send | null = null
  private unpatchButton = () => {}

  private setSuppressed(v: boolean) {
    this.suppressed = v
    for (const l of this.listeners) l(v)
  }

  start(): void {
    const instance = this

    this.originalSend = WebSocket.prototype.send
    const original = this.originalSend
    WebSocket.prototype.send = function (data) {
      if (
        instance.suppressed &&
        typeof data === 'string' &&
        data.includes('typing')
      ) {
        try {
          const type = JSON.parse(data).type
          if (type === 'typing' || type === 'user_typing') return
        } catch {}
      }
      return original.apply(this, arguments as any)
    }

    const Tooltip = this.api.findComponent<{
      tip: string
      position?: string
      offsetY?: number
      delay?: number
      zIndex?: string
      children?: React.ReactNode
    }>('Tooltip')
    const IconButtonBase = this.api.findComponent<{
      'size'?: string
      'className'?: string
      'aria-pressed'?: string
      'aria-label'?: string
      'data-qa'?: string
      'onClick'?: () => void
      'tabIndex'?: number
      'children'?: React.ReactNode
    }>('IconButtonBase')
    const SvgIcon = this.api.findComponent<{ name: string; size?: number }>(
      'SvgIcon'
    )

    this.unpatchButton = this.api.patchComponent<{}>(
      'TextyButtons',
      (Original) => (props) => {
        const [isSuppressed, setIsSuppressed] = React.useState(
          instance.suppressed
        )

        React.useEffect(() => {
          instance.listeners.add(setIsSuppressed)
          return () => {
            instance.listeners.delete(setIsSuppressed)
          }
        }, [])

        const label = isSuppressed
          ? 'Allow typing notifications'
          : 'Suppress typing notifications'

        return (
          <div
            className="taut-silent-typing-wrapper"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Original {...props} />
            <Tooltip
              tip={label}
              position="top"
              offsetY={-7}
              delay={500}
              zIndex="above_fs"
            >
              <IconButtonBase
                aria-pressed={String(isSuppressed)}
                aria-label={label}
                onClick={() => instance.setSuppressed(!isSuppressed)}
                tabIndex={-1}
                size="smedium"
              >
                <SvgIcon
                  name={
                    isSuppressed
                      ? 'notifications-off'
                      : 'notifications' /* notifications-all-new-posts */
                  }
                  size={18}
                />
              </IconButtonBase>
            </Tooltip>
          </div>
        )
      }
    )

    this.api.setStyle(
      'silent-typing',
      `.taut-silent-typing-wrapper .c-texty_buttons { flex: 1; min-width: 0; }`
    )

    this.log('Started')
  }

  stop(): void {
    if (this.originalSend) {
      WebSocket.prototype.send = this.originalSend
      this.originalSend = null
    }
    this.unpatchButton()
    this.api.removeStyle('silent-typing')
    this.log('Stopped')
  }
}
