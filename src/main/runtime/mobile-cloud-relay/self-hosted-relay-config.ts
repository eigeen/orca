import { open, stat } from 'node:fs/promises'
import type { RelayAuthContext } from './relay-auth-identity'

export type SelfHostedRelayConfig = {
  relayDirectorUrl: string
  relayTokenEndpoint: string
  tokenFile: string
}

export function normalizeSelfHostedRelayOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) {
    return null
  }
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && url.href === `${url.origin}/` ? url.origin : null
  } catch {
    return null
  }
}

export function createSelfHostedRelayConfig(
  origin: string,
  tokenFile: string
): SelfHostedRelayConfig {
  return { relayDirectorUrl: origin, relayTokenEndpoint: `${origin}/v1/self-host/token`, tokenFile }
}

/** undefined selects official Relay. null is an invalid explicit override. */
export function getSelfHostedRelayConfig(
  env: NodeJS.ProcessEnv = process.env
): SelfHostedRelayConfig | null | undefined {
  if (env.ORCA_SELF_HOSTED_RELAY_URL === undefined) {
    return undefined
  }
  const origin = normalizeSelfHostedRelayOrigin(env.ORCA_SELF_HOSTED_RELAY_URL)
  const tokenFile = env.ORCA_SELF_HOSTED_RELAY_TOKEN_FILE?.trim()
  return origin && tokenFile ? createSelfHostedRelayConfig(origin, tokenFile) : null
}

export async function readSelfHostedRelayToken(tokenFile: string): Promise<string | null> {
  const maxBytes = 128
  const info = await stat(tokenFile)
  if (!info.isFile() || info.size > maxBytes) {
    return null
  }
  const file = await open(tokenFile, 'r')
  try {
    const bytes = Buffer.alloc(maxBytes + 1)
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0)
    const token = bytes.toString('utf8', 0, bytesRead).trim()
    return bytesRead <= maxBytes && /^[a-f0-9]{64}$/.test(token) ? token : null
  } finally {
    await file.close()
  }
}

export async function readSelfHostedRelayAuth(
  config: SelfHostedRelayConfig
): Promise<RelayAuthContext | null> {
  const accessToken = await readSelfHostedRelayToken(config.tokenFile)
  if (!accessToken) {
    return null
  }
  return {
    // The origin isolates paired-device demand and revocations from other servers.
    identity: { userId: 'self-hosted', profileId: config.relayDirectorUrl, organizationId: '' },
    accessToken,
    relayEntitled: true
  }
}
