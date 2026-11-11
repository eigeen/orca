import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { z } from 'zod'
import { writeSecureJsonFile } from '../../../shared/secure-storage/secure-file'
import type { SelfHostedRelaySettings } from '../../../shared/remote-runtime/relay/self-hosted-relay-settings'
import {
  createSelfHostedRelayConfig,
  getSelfHostedRelayConfig,
  normalizeSelfHostedRelayOrigin,
  type SelfHostedRelayConfig
} from './self-hosted-relay-config'

const Preference = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('official') }),
  z.object({ mode: z.literal('self-hosted'), origin: z.string(), tokenFile: z.string() })
])

type EffectiveConfig = SelfHostedRelayConfig | null | undefined
type ActivePreference = {
  directory: string
  config: EffectiveConfig
  ready: Promise<EffectiveConfig>
}

let active: ActivePreference | undefined

function preferencePath(directory: string): string {
  return join(directory, 'mobile-relay', 'preference.json')
}

async function readNextConfig(directory: string): Promise<EffectiveConfig> {
  try {
    const raw: unknown = JSON.parse(await readFile(preferencePath(directory), 'utf8'))
    const preference = Preference.safeParse(raw)
    if (!preference.success) {
      return null
    }
    if (preference.data.mode === 'official') {
      return undefined
    }
    const { origin, tokenFile } = preference.data
    const normalizedOrigin = normalizeSelfHostedRelayOrigin(origin)
    return normalizedOrigin && isAbsolute(tokenFile)
      ? createSelfHostedRelayConfig(normalizedOrigin, tokenFile)
      : null
  } catch (error) {
    return error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
      ? getSelfHostedRelayConfig()
      : null
  }
}

// Keep pairing, auth status and push on the same configuration until an explicit restart.
export function initializeSelfHostedRelayConfig(directory: string): Promise<EffectiveConfig> {
  if (active?.directory === directory) {
    return active.ready
  }
  const selection: ActivePreference = {
    directory,
    config: undefined,
    ready: readNextConfig(directory).then((config) => {
      selection.config = config
      return config
    })
  }
  active = selection
  return selection.ready
}

export function getActiveSelfHostedRelayConfig(directory: string): EffectiveConfig {
  return active?.directory === directory ? active.config : getSelfHostedRelayConfig()
}

export async function getSelfHostedRelaySettings(
  directory: string
): Promise<SelfHostedRelaySettings> {
  const current = await initializeSelfHostedRelayConfig(directory)
  const next = await readNextConfig(directory)
  return {
    origin: next?.relayDirectorUrl ?? null,
    credentialName: next ? basename(next.tokenFile) : null,
    selfHosted: next !== undefined,
    restartRequired:
      (current === null) !== (next === null) ||
      current?.relayDirectorUrl !== next?.relayDirectorUrl ||
      current?.tokenFile !== next?.tokenFile
  }
}

export async function saveSelfHostedRelaySettings(
  directory: string,
  preference: z.infer<typeof Preference>
): Promise<SelfHostedRelaySettings> {
  await initializeSelfHostedRelayConfig(directory)
  writeSecureJsonFile(preferencePath(directory), preference)
  return getSelfHostedRelaySettings(directory)
}
