// Suppresses typing indicators so others can't see when you're typing

import { TautPlugin } from '$taut'

export default class SilentTyping extends TautPlugin {
  static readonly pluginName = 'Silent Typing'
  static readonly description =
    "Adds a button to suppress typing indicators so others can't see when you're typing"
  static readonly authors = '<@U06UYA5GMB5>, <@U080A3QP42C>, <@U01D9DWGEB0>'
  static readonly defaultConfig = `
    // Adds a button to suppress typing indicators so others can't see when you're typing
    "SilentTyping": {
      "enabled": true
    }
  `

  private static readonly STORAGE_KEY = 'taut_silent_typing_suppressed'
  private suppressed = false
  private readonly listeners = new Set<(v: boolean) => void>()
  private unpatchInput = () => {}
  private unpatchButton = () => {}

  private setSuppressed(v: boolean) {
    this.suppressed = v
    localStorage.setItem(SilentTyping.STORAGE_KEY, String(v))
    for (const l of this.listeners) l(v)
  }

  start(): void {
    this.suppressed = localStorage.getItem(SilentTyping.STORAGE_KEY) === 'true'

    const instance = this

    this.unpatchInput = this.api.patchComponent<{
      currentUserStartedTyping?: () => void
      currentUserEndedTyping?: () => void
    }>('MessagePaneInput', (Original) => (props) => {
      const [isSuppressed, setIsSuppressed] = React.useState(
        instance.suppressed
      )

      React.useEffect(() => {
        instance.listeners.add(setIsSuppressed)
        return () => {
          instance.listeners.delete(setIsSuppressed)
        }
      }, [])

      if (isSuppressed) {
        props = {
          ...props,
          currentUserStartedTyping: () => {},
          currentUserEndedTyping: () => {},
        }
      }

      return <Original {...props} />
    })

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
    this.unpatchInput()
    this.unpatchButton()
    this.api.removeStyle('silent-typing')
    this.log('Stopped')
  }
}
