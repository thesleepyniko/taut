import net from 'net'
import os from 'os'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
// niko's thinking:
// step 1: set up the socket (IPC socket?) locally, different path for win32
// step 2: set up a listener to continually listen for stuff
// step 3: you need a plugin

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
    // 'connection' listener.
    let buffer = "" // made per connection

    // data structure
    // A: {...}\n{...} (two seperate pieces of data, NDJSON)
    // B: [1 0 0 0][0 0 0 0]{...} (8 bytes to tell what its trying to do and size of msg, then the JSON, also what discord uses)
    // going to implement two seperate methods and see how they are
    c.setEncoding('utf8')

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
    // console.log('client connected');
    // c.on('end', () => {
    //   console.log('client disconnected');
    // });
    // c.write('hello\r\n');
    // c.pipe(c);
  });
  server.on('error', (err) => {
    console.log(`[Taut]: Presence server encounted error ${ err }`)
  });
  server.listen(socketPath, () => {
    console.log(`[Taut]: Presence server set up at ${ socketPath }`);
  });

  return { close: () => server.close() }
}

// the following function implements option B
// function setUpPresenceAlt() {
//   let clientWebContents: Electron.WebContents | null = null; // how we...well...send data to whats going to listen
//   const net = require("net");
//   const maxMessageLength = 64000; // 64kb
//   let isWin32 = null;
//   if (os.platform() == "win32") {
//     isWin32 = true;
//   } else {
//     isWin32 = false;
//   }
//   const socketPath = isWin32
//     ? "\\\\.\\pipe\\taut-presence"
//     : path.join(os.tmpdir(), "taut-presence.sock"); // set the path for the presence

//   if (existsSync(socketPath) && !isWin32) {
//     // if the socket already exists... (unless on win32 for weird windows things)
//     unlinkSync(socketPath); // unlink the socket as we will need to make a new one
//   }

//   const server = net.createServer((c) => {
//     let buffer = Buffer.alloc(0); // since we're working with bytes, make the buffer an...actual buffer

//     c.on("data", (chunk) => {
//       chunk = Buffer.from(chunk); // in case chunk is not binary, make it binary
//       buffer = Buffer.concat([buffer, chunk]); // first, append the data into the chunk

//       while (buffer.length >= 8) {
//         // if the buffer is larger than 8 bytes, this indicates that we have a msesage with data
//         let msgType = buffer.subarray(0, 4); // bytes 0-3
//         let msgLength = buffer.subarray(4, 8); // bytes 4-7

//         if (buffer.length >= maxMessageLength) {
//           // if the writer is being bad, just destroy the client
//           buffer = Buffer.alloc(0);
//           c.destroy();
//           return; // exit out of this since there is no more data
//         }

        
//       }
//     });
//   });
// }
// i mean at its core you're just sending bytes right? just check the length, no?