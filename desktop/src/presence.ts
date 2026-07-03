import net from 'net'
import os from 'os'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'

export function createPresenceServer( onMessage: (msg: unknown) => void ) {
  let isWin32 = null
  if (os.platform() == "win32") {
    isWin32 = true
  } else {
    isWin32 = false
  }
  const socketPath =  isWin32 ? "\\\\.\\pipe\\taut-presence" : path.join(os.tmpdir(), "taut-presence.sock") // set the path for the presence

  if (existsSync(socketPath) && !isWin32) { // if the socket already exists... (unless on win32 for weird windows things)
      unlinkSync(socketPath); // unlink the socket as we will need to make a new one
  }

  const server = net.createServer((c) => {
    let buffer = "" // made per connection
    c.setEncoding('utf8') // make sure all chunks are handled as utf-8 strings

    c.on("data", (chunk: string) => {
      buffer += chunk // add chunk to buf as string
      let newlinePos = buffer.indexOf("\n") // check if some data has completed sending
      
      while (newlinePos != -1) { // if above is yes:
        const line = buffer.slice(0, newlinePos).trim() // slice out the message
        buffer = buffer.slice(newlinePos + 1) // return everything after the first msg
        if (!line) continue // if what we just sliced out doesn;t exist for any reason, continue
        newlinePos = buffer.indexOf("\n") // recompute to not get stuck in an infinite loop

        try {
          const msg = JSON.parse(line)
          onMessage(msg)
        } catch (e) {
          console.log("[Taut]: Presence server encounted bad data, dropping.")
          console.log(`Taut]: Error was: ${ e }`)
        }
      }
    })
  });
  server.on('error', (err) => {
    console.log(`[Taut]: Presence server encounted error ${ err }`)
  });
  server.listen(socketPath, () => {
    console.log(`[Taut]: Presence server set up at ${ socketPath }`);
  });

  return { close: () => server.close() }
}
