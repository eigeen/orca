import { parentPort, workerData } from 'node:worker_threads'
import { writeSecureFile } from '../../../shared/secure-storage/secure-file'
import { installWorkerSendLedger } from '../../worker-threads/worker-send-ledger'
import type { SelfHostedRelayPreferenceWrite } from './self-hosted-relay-preference-writer'

installWorkerSendLedger('orca-self-hosted-relay-preference-write')

if (!parentPort) {
  throw new Error('Relay preference writes must run on a worker thread')
}
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the preference writer is the sole spawner and supplies this job.
const { path, contents } = workerData as SelfHostedRelayPreferenceWrite
try {
  writeSecureFile(path, contents)
  parentPort.postMessage(null)
} catch (error) {
  parentPort.postMessage(error instanceof Error ? error.message : String(error))
} finally {
  parentPort.close()
}
