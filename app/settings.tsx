// Taut Settings Tab
// Adds a "Taut" tab to Slack's Preferences dialog
// Shows installed plugins, config info, and credits

import {
  reactPromise,
  findComponentPromise,
  patchComponentPromise,
} from './slack/react'
import type { ConfigStore } from './configStore'
import type { PluginInfo, PluginManager } from './pluginManager'
import { initMonaco, type Monaco } from './cdn'
import { tautVersion } from './bundledData'

type MonacoEditorInstance = ReturnType<Monaco['editor']['create']>

type ButtonProps = {
  type?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'small' | 'medium' | 'large'
  icon?: string
  href?: string
  htmlType?: 'button' | 'submit' | 'reset'
}

let MrkdwnElement: React.ComponentType<{ text: string }>
let Button: React.ComponentType<
  ButtonProps &
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonProps>
>

export async function addSettingsTab(
  pluginManager: PluginManager,
  configStore: ConfigStore
) {
  await reactPromise

  void initMonaco()

  const findComponent = await findComponentPromise
  const patchComponent = await patchComponentPromise

  MrkdwnElement = findComponent<{ text: string }>('MrkdwnElement')
  Button = findComponent<
    ButtonProps &
      Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonProps>
  >('Button')

  patchComponent<{
    tabs: {
      'label': React.ReactElement
      'content': React.ReactElement
      'svgIcon': {
        name: string
      }
      'id'?: string
      'aria-labelledby'?: string
      'aria-label'?: string
    }[]
    onTabChange?: (id: string, e: React.UIEvent) => void
    currentTabId?: string
  }>('Tabs', (OriginalTabs) => (props) => {
    const [isTautSelected, setIsTautSelected] = React.useState(false)

    const tabs = [...props.tabs]
    if (tabs[tabs.length - 1]?.id === 'advanced') {
      tabs.push({
        'id': 'taut',
        'label': <>Taut</>,
        'content': (
          <TautSettings
            pluginManager={pluginManager}
            configStore={configStore}
          />
        ),
        'svgIcon': { name: 'code' },
        'aria-label': 'taut',
      })
    }

    const handleTabChange = (id: string, e: React.UIEvent) => {
      if (id === 'taut') {
        setIsTautSelected(true)
        if (props.onTabChange) props.onTabChange('advanced', e)
      } else {
        setIsTautSelected(false)
        if (props.onTabChange) props.onTabChange(id, e)
      }
    }

    const activeTabId = isTautSelected ? 'taut' : props.currentTabId

    return (
      <OriginalTabs
        {...props}
        tabs={tabs}
        currentTabId={activeTabId}
        onTabChange={handleTabChange}
      />
    )
  })
}

const LOADER_DISPLAY_NAMES: Record<string, string> = {
  'chrome-extension': 'Chrome extension',
  'firefox-extension': 'Firefox extension',
  'electron': 'Desktop',
  'userscript': 'Userscript',
}

function TautSettings({
  pluginManager,
  configStore,
}: {
  pluginManager: PluginManager
  configStore: ConfigStore
}) {
  const bridge = window.TautBridge
  const paths = bridge.PATHS
  const loaderName = LOADER_DISPLAY_NAMES[bridge.loader] ?? bridge.loader

  return (
    <div>
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '8px',
        }}
      >
        Taut Settings
      </div>
      <MrkdwnElement
        text={`<#C0A057686SF> v${tautVersion} | ${loaderName} v${bridge.loaderVersion} | <https://github.com/jeremy46231/taut|Repository>`}
      />
      {paths && (
        <MrkdwnElement
          text={`Config Directory: \`${paths.display.tautDir}\``}
        />
      )}
      <hr />
      <PluginList pluginManager={pluginManager} configStore={configStore} />
      <hr />
      <div style={{ marginTop: '16px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          Edit Configuration
        </div>
        <ConfigEditor configStore={configStore} />
        <div style={{ height: '24px' }} />
        <UserCssEditor configStore={configStore} />
      </div>
      <hr />
      <MrkdwnElement text="Created by <@U06UYA5GMB5>, <https://github.com/jeremy46231/taut#credits|credits>" />
    </div>
  )
}

function ConfigEditor({ configStore }: { configStore: ConfigStore }) {
  const [text, setText] = React.useState<string>('')
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const bridge = window.TautBridge
  const paths = bridge.PATHS

  React.useEffect(() => {
    setText(configStore.getConfigText())
  }, [])

  React.useEffect(() => {
    return configStore.onConfigTextChange((newText) => {
      if (!dirty) {
        setText(newText)
      }
    })
  }, [dirty])

  const handleSave = async () => {
    setSaving(true)
    await configStore.updateConfigText(text)
    setDirty(false)
    setSaving(false)
  }

  return (
    <div>
      {paths && <MrkdwnElement text={`Editing \`${paths.display.config}\``} />}
      {!paths && (
        <MrkdwnElement
          text={`Editing config (stored in ${LOADER_DISPLAY_NAMES[bridge.loader] ?? bridge.loader} storage)`}
        />
      )}
      <MonacoEditor
        language="json"
        value={text}
        onChange={(newText) => {
          setText(newText)
          setDirty(true)
        }}
        style={{ height: '300px', marginTop: '8px' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save config.jsonc'}
        </Button>
        <div style={{ fontSize: '12px', color: 'var(--sk_foreground_low)' }}>
          {dirty ? 'Unsaved changes' : 'Saved'}
        </div>
      </div>
    </div>
  )
}

function UserCssEditor({ configStore }: { configStore: ConfigStore }) {
  const [text, setText] = React.useState<string>('')
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const bridge = window.TautBridge
  const paths = bridge.PATHS

  React.useEffect(() => {
    setText(configStore.getUserCssText())
  }, [])

  React.useEffect(() => {
    return configStore.onUserCssChange((newText) => {
      if (!dirty) {
        setText(newText)
      }
    })
  }, [dirty])

  const handleSave = async () => {
    setSaving(true)
    await configStore.updateUserCssText(text)
    setDirty(false)
    setSaving(false)
  }

  return (
    <div>
      {paths && <MrkdwnElement text={`Editing \`${paths.display.userCss}\``} />}
      {!paths && (
        <MrkdwnElement
          text={`Editing user.css (stored in ${LOADER_DISPLAY_NAMES[bridge.loader] ?? bridge.loader} storage)`}
        />
      )}
      <MonacoEditor
        language="css"
        value={text}
        onChange={(newText) => {
          setText(newText)
          setDirty(true)
        }}
        style={{ height: '300px', marginTop: '8px' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save user.css'}
        </Button>
        <div style={{ fontSize: '12px', color: 'var(--sk_foreground_low)' }}>
          {dirty ? 'Unsaved changes' : 'Saved'}
        </div>
      </div>
    </div>
  )
}

interface EditorProps {
  language?: 'json' | 'css'
  value: string
  onChange: (value: string) => void
}

function MonacoEditor({
  language,
  value,
  onChange,
  style,
  ...props
}: EditorProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof EditorProps>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const editorRef = React.useRef<MonacoEditorInstance | null>(null)
  const valueRef = React.useRef(value)
  /** if the editor is currently updating its value externally, so don't fire onChange */
  const isUpdatingRef = React.useRef(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  React.useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      const monaco = await initMonaco()
      if (cancelled || !containerRef.current) return

      const editor = monaco.editor.create(containerRef.current, {
        value: valueRef.current,
        language,
        automaticLayout: true,
        theme: 'taut',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        tabSize: 2,
      })
      editorRef.current = editor
      setLoading(false)

      const sub = editor.onDidChangeModelContent(() => {
        if (isUpdatingRef.current) return
        onChange(editor.getValue())
      })

      cleanup = () => {
        sub.dispose()
        editor.dispose()
        editorRef.current = null
      }
    })()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [language])

  React.useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.getValue() !== value) {
      const position = editor.getPosition()
      isUpdatingRef.current = true
      editor.setValue(value)
      if (position) editor.setPosition(position)
      isUpdatingRef.current = false
    }
  }, [value])

  return (
    <div style={style} {...props}>
      {loading && (
        <div
          style={{
            padding: '8px',
            fontSize: '12px',
            color: 'var(--sk_foreground_low)',
          }}
        >
          Monaco loading...
        </div>
      )}
      <div ref={containerRef} style={{ height: loading ? '0' : '100%' }} />
    </div>
  )
}

function PluginList({
  pluginManager,
  configStore,
}: {
  pluginManager: PluginManager
  configStore: ConfigStore
}) {
  const [pluginInfo, setPluginInfo] = React.useState(() =>
    pluginManager.getPluginInfo()
  )
  const [togglingPlugins, setTogglingPlugins] = React.useState<Set<string>>(
    () => new Set()
  )

  const pluginInfoRef = React.useRef(pluginInfo)
  React.useEffect(() => {
    pluginInfoRef.current = pluginInfo
  })

  const timeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  React.useEffect(() => {
    const onChange = (event: CustomEvent<PluginInfo>) => {
      const newPluginInfo = event.detail
      const oldPluginInfo = pluginInfoRef.current

      setTogglingPlugins((prev) => {
        const next = new Set(prev)
        for (const id of prev) {
          const oldP = oldPluginInfo.find((p) => p.id === id)
          const newP = newPluginInfo.find((p) => p.id === id)
          if (oldP && newP && oldP.enabled !== newP.enabled) {
            next.delete(id)
            const timeout = timeoutsRef.current.get(id)
            if (timeout) {
              clearTimeout(timeout)
              timeoutsRef.current.delete(id)
            }
          }
        }
        return next
      })
      setPluginInfo(newPluginInfo)
    }
    pluginManager.on('pluginInfoChanged', onChange)
    return () => {
      pluginManager.off('pluginInfoChanged', onChange)
    }
  }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingPlugins((prev) => new Set(prev).add(id))
    await configStore.setPluginEnabled(id, enabled)

    const existingTimeout = timeoutsRef.current.get(id)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(() => {
      setTogglingPlugins((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      timeoutsRef.current.delete(id)
    }, 5000)
    timeoutsRef.current.set(id, timeout)
  }

  return (
    <>
      <div
        style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 'bold' }}
      >
        Installed Plugins:
      </div>
      <ul style={{ marginLeft: '0' }}>
        {pluginInfo.map((info, index) => (
          <li key={index} style={{ marginBottom: '12px', listStyle: 'none' }}>
            <label style={{ display: 'flex', alignItems: 'start' }}>
              <input
                type="checkbox"
                checked={
                  !togglingPlugins.has(info.id) ? info.enabled : !info.enabled
                }
                disabled={togglingPlugins.has(info.id)}
                onChange={(e) => handleToggle(info.id, e.target.checked)}
                className="c-input_checkbox"
                style={{
                  marginRight: '8px',
                  marginTop: '5px',
                }}
              />
              <div>
                <span style={{ fontWeight: 'bold' }}>{info.name}</span>
                <div>
                  <MrkdwnElement text={info.description} />
                </div>
                <div>
                  <small>
                    <MrkdwnElement text={`Authors: ${info.authors}`} />
                  </small>
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}
