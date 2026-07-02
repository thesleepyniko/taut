// Locally rename other members from their profile "..." menu - only you see
// it, everyone else still sees their real name

import { TautPlugin } from '$taut'

type NicknameMap = Record<string, string>

type MenuTemplateItem = {
  key?: string
  label?: React.ReactNode
  type?: 'separator' | string
  click?: (e?: unknown) => void
  [extra: string]: unknown
}
type MenuFromTemplateProps = { template?: MenuTemplateItem[] }
type OverflowMenuProps = { memberId?: string }
type MemberLike = {
  real_name?: string
  profile?: { display_name?: string; real_name?: string; image_48?: string }
}

const STORAGE_KEY = 'taut_nicknames'
const NICKNAME_ITEM_KEY = 'taut-set-nickname'

function loadNicknames(): NicknameMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveNicknames(nicknames: NicknameMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nicknames))
  } catch {}
}

export default class Nicknames extends TautPlugin {
  static readonly pluginName = 'Nicknames'
  static readonly description = 'Locally nickname other members across Slack'
  static readonly authors = '<@U06UYA5GMB5>'
  static readonly defaultConfig = `
    // Locally nickname other members
    "Nicknames": {
      "enabled": true
    }
  `

  private readonly MemberIdContext = React.createContext<string | null>(null)

  private nicknames: NicknameMap = loadNicknames()
  private unpatchOverflowMenu = () => {}
  private unpatchMenuFromTemplate = () => {}
  private unpatchRedux = () => {}

  start() {
    this.applyReduxPatch()

    this.unpatchOverflowMenu = this.api.patchComponent<OverflowMenuProps>(
      'RimetoMemberProfileOverflowMenu',
      (Original) => (props) => (
        <this.MemberIdContext.Provider value={props.memberId ?? null}>
          <Original {...props} />
        </this.MemberIdContext.Provider>
      )
    )

    this.unpatchMenuFromTemplate =
      this.api.patchComponent<MenuFromTemplateProps>(
        'MenuFromTemplate',
        (Original) => (props) => {
          const memberId = React.useContext(this.MemberIdContext)
          const template = props.template
          if (memberId && Array.isArray(template)) {
            const idx = template.findIndex(
              (it) =>
                typeof it?.label === 'string' &&
                it.label.startsWith('Copy display name')
            )
            const already = template.some((it) => it?.key === NICKNAME_ITEM_KEY)
            if (idx !== -1 && !already) {
              const next = [
                ...template.slice(0, idx + 1),
                {
                  key: NICKNAME_ITEM_KEY,
                  label: 'Set nickname…',
                  click: () => this.openNicknameModal(memberId),
                },
                ...template.slice(idx + 1),
              ]
              return <Original {...props} template={next} />
            }
          }
          return <Original {...props} />
        }
      )

    this.log('Started')
  }

  stop() {
    this.unpatchOverflowMenu()
    this.unpatchMenuFromTemplate()
    this.unpatchRedux()
    this.log('Stopped')
  }

  private applyReduxPatch() {
    this.unpatchRedux()
    const nicknames = this.nicknames
    this.unpatchRedux = this.api.redux.patchSlice('members', (member, key) => {
      const nickname = nicknames[key]
      if (!nickname || !member?.profile) return member
      return {
        ...member,
        real_name: nickname,
        profile: {
          ...member.profile,
          display_name: nickname,
          real_name: nickname,
        },
      }
    })
  }

  private setNickname(userId: string, nickname: string) {
    const trimmed = nickname.trim()
    const next = { ...this.nicknames }
    if (trimmed) next[userId] = trimmed
    else delete next[userId]
    this.nicknames = next
    saveNicknames(next)
    this.applyReduxPatch()
  }

  private openNicknameModal(userId: string) {
    const member: MemberLike | undefined = this.api.redux.getStore()?.getState()
      ?.members?.[userId]
    const realName =
      member?.profile?.display_name ||
      member?.profile?.real_name ||
      member?.real_name ||
      userId

    const { Label, TextInput } = this.api.modal
    const valueRef = { current: this.nicknames[userId] ?? '' }

    const NicknameField = () => {
      const [value, setValue] = React.useState(valueRef.current)
      return (
        <>
          <Label text="Nickname" htmlFor="taut-nickname-input" optional />
          <TextInput
            id="taut-nickname-input"
            value={value}
            onChange={(next) => {
              setValue(next)
              valueRef.current = next
            }}
            placeholder={realName}
            hintText="Leave blank to show their real name again"
            autoFocus
          />
        </>
      )
    }

    this.api.modal.openModal({
      title: `Set nickname for ${realName}`,
      submitText: 'Save',
      cancelText: 'Cancel',
      body: <NicknameField />,
      onSubmit: () => this.setNickname(userId, valueRef.current),
    })
  }
}
