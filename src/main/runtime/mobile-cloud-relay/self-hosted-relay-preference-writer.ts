import { spawnWorkerThread } from '../../worker-threads/worker-thread-spawn'
import {
  currentWorkerEntryLayout,
  resolveWorkerThreadEntryPath
} from '../../worker-threads/worker-thread-entry-path'

export type SelfHostedRelayPreferenceWrite = { path: string; contents: string }

export async function writeSelfHostedRelayPreference(
  path: string,
  contents: string
): Promise<void> {
  const workerPath = resolveWorkerThreadEntryPath(
    currentWorkerEntryLayout(__dirname),
    'self-hosted-relay-preference-write-worker-entry.js'
  )
  const worker = spawnWorkerThread(workerPath, {
    name: 'orca-self-hosted-relay-preference-write',
    workerData: { path, contents } satisfies SelfHostedRelayPreferenceWrite
  })
  return new Promise((resolve, reject) => {
    worker.once('message', (error: string | null) => {
      if (error === null) {
        resolve()
      } else {
        reject(new Error(error))
      }
    })
    worker.once('error', reject)
    worker.once('exit', (code) => reject(new Error(`Relay preference writer exited (${code})`)))
  })
}
