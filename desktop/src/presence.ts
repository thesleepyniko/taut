import net from 'net'
import os from 'os'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
// niko's thinking:
// step 1: set up the socket (IPC socket?) locally, different path for win32
// step 2: set up a listener to continually listen for stuff
// step 3: you need a plugin

type SocketStatus = "alive" | "dead" | "missing"

export type PresenceServerHandle = { close: () => void }

export type PresenceServerResult =
  | ({ status: 'started' } & PresenceServerHandle)   // handle included — same process
  | { status: 'yielded' }
  | { status: 'error'; details: string }

function probeSocket(socketPath: string): Promise<SocketStatus> {
    return new Promise((resolve) => {
        if (os.platform() !== 'win32' && !existsSync(socketPath)) {
            return resolve('missing') // no file so theres nothing to unlink
        }

        const probe = net.connect(socketPath)

        const finish = (status: SocketStatus) => {
            probe.destroy()
            resolve(status)
        }
        
        probe.once('connect', () => {finish('alive')}) // if we connect fine its alive
        probe.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code == 'ECONNREFUSED') {
                finish('dead') // if the conn is refused, consider it dead
            } else if (err.code == 'EACCES') {
                finish('alive') // if someone else is using it (or we don't have access), it's alive
            } else {
                finish('missing') // its missing otherwise
            }
        })

        probe.setTimeout(1000, () => finish('alive')) // if none of the above happen but 1 second passes, just set it as alive
    });
}

export async function createPresenceServer( onMessage: (msg: unknown) => void ): Promise<PresenceServerResult> {
    let isWin32 = null
    if (os.platform() == "win32") {
        isWin32 = true
    } else {
        isWin32 = false
    }
    const socketPath =  isWin32 ? "\\\\.\\pipe\\taut-presence" : path.join(os.tmpdir(), "taut-presence.sock") // set the path for the presence

    let socketStatus = await probeSocket(socketPath)
    let currPathIndex = 0
    if (socketStatus == 'dead' || socketStatus == 'missing') {
        if (existsSync(socketPath) && !isWin32) { // if the socket already exists... (unless on win32 for weird windows things)
            unlinkSync(socketPath); // unlink the socket as we will need to make a new one
        }
    }
    while (socketStatus == 'alive') {
        if (currPathIndex >= 9) {
            return { status: "error", details: "Too many taut-presence files. Check if you have more than 1 Taut instance open." }
        }
        currPathIndex += 1
        // keep trying with new socket paths up until 9
        let tempSocketPath =  isWin32 ? `\\\\.\\pipe\\taut-presence-${ currPathIndex }` : path.join(os.tmpdir(), `taut-presence-${ currPathIndex }.sock`)
        socketStatus = await probeSocket(socketPath)

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

    try { await new Promise((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
    })} catch (e) {
        return { status: "error", details: String(e) }
    }

    return { status: "started", close: () => server.close() }
}

// the following function implements option B
export async function createAltPresenceServer( onMessage: (msg: unknown) => void ): Promise<PresenceServerResult> {
    const maxMessageLength = 64000; // 64kb
    let isWin32 = null;

    const socketPath = os.platform() === 'win32'
    ? '\\\\?\\pipe\\discord-ipc-0'
    : path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), 'discord-ipc-0')

    const socketStatus = await probeSocket(socketPath)
    if (socketStatus === 'alive') {
        console.log('[Taut]: Discord is already on ipc-0, terminating server')
        return { status: "yielded" } // yield the slot to discord
        // we do not do the same thing as the regular presence since we need to bind to ipc-0
    }
    if (socketStatus === 'dead') {
        unlinkSync(socketPath)
    }
    

    const server = net.createServer((c) => {
        let buffer = Buffer.alloc(0); // since we're working with bytes, make the buffer an...actual buffer

        c.on("data", (chunk) => {
        chunk = Buffer.from(chunk); // in case chunk is not binary, make it binary
        buffer = Buffer.concat([buffer, chunk]); // first, append the data into the chunk

        while (buffer.length >= 8) {
            // if the buffer is larger than 8 bytes, this indicates we have the headers for a message
            let msgTypeBuffer = buffer.subarray(0, 4); // bytes 0-3
            let msgLengthBuffer = buffer.subarray(4, 8); // bytes 4-7

            let msgType: number
            let msgLength: number

            try {
                // in case somehow they pass in some evil ass data
                msgType = msgTypeBuffer.readUInt32LE(0)
                msgLength = msgLengthBuffer.readUInt32LE(0)
            } catch (e) {
                console.log(`[Taut]: Error parsing msgType or msgLength ${ e }`)
                buffer = Buffer.alloc(0);
                c.destroy();
                return;
            }

            if (msgLength >= maxMessageLength) {
                // if the writer is being bad, just destroy the client
                buffer = Buffer.alloc(0);
                c.destroy();
                return; // exit out of this since there is no more data
            }

            if (buffer.length < msgLength + 8) break;

            let msg = buffer.subarray(8, msgLength + 8).toString("utf-8");
            buffer = Buffer.from(buffer.subarray(msgLength + 8));

            try {
                onMessage(JSON.parse(msg));
            } catch (e) {
                console.log(`[Taut]: Error parsing msg: ${ e }`)
                buffer = Buffer.alloc(0);
                c.destroy();
                return;
            }
            
        }
        });
    });
    server.on('error', (err) => {
    console.log(`[Taut]: Discord presence server encounted error ${ err }`)
    });
    server.listen(socketPath, () => {
        console.log(`[Taut]: Discord presence server set up at ${ socketPath }`);
    });

    try { await new Promise((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
    })} catch (e) {
        return { status: "error", details: String(e) }
    }

    return { status: "started", close: () => server.close() }
}
