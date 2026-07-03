// Rich Presence for Taut

import { TautPlugin } from '$taut'
import type { TautPresenceMessage } from '../shared/TautBridge'

function isPresenceMessage(msg: unknown): msg is TautPresenceMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const op = (msg as { op?: unknown }).op
  return op === 'set' || op === 'clear'
}

export default class RichPresence extends TautPlugin {
  static readonly pluginName = 'Rich Presence'
  static readonly description = 'Enables Taut Rich Presence and its server.'
  static readonly defaultConfig = `
    // Enables Taut Rich Presence along with the respective server.
    "RichPresence": {
      "enabled": true
    }
  `
  static readonly authors = '<@U08SF8MVC82>'

  private unsubscribe: (() => void) | null = null  // for the unsubscribe

  start() {
    if (!this.api.presence) {
      this.log('Presence bridge not available on this backend, not doing anything')
      return
    }
    this.api.presence?.start()
    this.unsubscribe = this.api.presence.onMessage(async (msg) => {
      if (!isPresenceMessage(msg)) return
      try {
        if (msg.op === 'set') {
          await this.api.userAPI('users.profile.set', {
            profile: JSON.stringify({
              status_text: msg.text ?? '',
              status_emoji: msg.emoji ?? '',
              status_expiration: msg.ttl
                ? String(Math.floor(Date.now() / 1000) + msg.ttl)
                : '0',
            }),
          })
          this.log('Status set:', msg.text, msg.emoji)
        } else {
          // set everything empty
          await this.api.userAPI('users.profile.set', {
            profile: JSON.stringify({ status_text: '', status_emoji: '' }),
          })
          this.log('Status cleared')
        }
      } catch (e) {
        this.log('Failed to update status with error', e)
      }
    })
    this.log('Presence Started')
  }

  stop() {
    // if you ever modify this, remember to unsubscribe the listener before stopping
    this.unsubscribe?.()
    this.unsubscribe = null
    this.api.presence?.stop()
    this.log('Stopped')
  }

}
