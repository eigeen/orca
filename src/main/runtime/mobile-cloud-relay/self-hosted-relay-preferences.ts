import { readFileSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { z } from 'zod'
import { writeSecureJsonFile } from '../../../shared/secure-file'
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
let active: { directory: string; config: EffectiveConfig } | undefined

function preferencePath(directory: string): string {
  return join(directory, 'mobile-relay', 'preference.json')
}

function readNextConfig(directory: string): EffectiveConfig {
  try {
    const raw: unknown = JSON.parse(readFileSync(preferencePath(directory), 'utf8'))
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
export function getActiveSelfHostedRelayConfig(directory: string): EffectiveConfig {
  if (active?.directory !== directory) {
    active = { directory, config: readNextConfig(directory) }
  }
  return active.config
}

export function getSelfHostedRelaySettings(directory: string): SelfHostedRelaySettings {
  const current = getActiveSelfHostedRelayConfig(directory)
  const next = readNextConfig(directory)
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

export function saveSelfHostedRelaySettings(
  directory: string,
  preference: z.infer<typeof Preference>
): SelfHostedRelaySettings {
  getActiveSelfHostedRelayConfig(directory)
  writeSecureJsonFile(preferencePath(directory), preference)
  return getSelfHostedRelaySettings(directory)
}
