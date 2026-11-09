import { readFile } from 'node:fs/promises'
import type { RelayAuthContext } from './relay-auth-identity'

export type SelfHostedRelayConfig = {
  relayDirectorUrl: string
  relayTokenEndpoint: string
  tokenFile: string
}

/** undefined selects official Relay. null is an invalid explicit override. */
export function getSelfHostedRelayConfig(
  env: NodeJS.ProcessEnv = process.env
): SelfHostedRelayConfig | null | undefined {
  if (env.ORCA_SELF_HOSTED_RELAY_URL === undefined) {
    return undefined
  }
  const tokenFile = env.ORCA_SELF_HOSTED_RELAY_TOKEN_FILE?.trim()
  try {
    const url = new URL(env.ORCA_SELF_HOSTED_RELAY_URL.trim())
    if (
      !tokenFile ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.href !== `${url.origin}/`
    ) {
      return null
    }
    return {
      relayDirectorUrl: url.origin,
      relayTokenEndpoint: `${url.origin}/v1/self-host/token`,
      tokenFile
    }
  } catch {
    return null
  }
}

export async function readSelfHostedRelayAuth(
  config: SelfHostedRelayConfig
): Promise<RelayAuthContext | null> {
  const accessToken = (await readFile(config.tokenFile, 'utf8')).trim()
  if (!/^[a-f0-9]{64}$/.test(accessToken)) {
    return null
  }
  return {
    // The origin isolates paired-device demand and revocations from other servers.
    identity: { userId: 'self-hosted', profileId: config.relayDirectorUrl, organizationId: '' },
    accessToken,
    relayEntitled: true
  }
}
