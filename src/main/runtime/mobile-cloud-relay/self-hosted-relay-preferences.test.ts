import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getActiveSelfHostedRelayConfig,
  saveSelfHostedRelaySettings
} from './self-hosted-relay-preferences'

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'orca-relay-preferences-'))
  vi.stubEnv('ORCA_SELF_HOSTED_RELAY_URL', 'https://env-relay.example.com')
  vi.stubEnv('ORCA_SELF_HOSTED_RELAY_TOKEN_FILE', join(directory, 'env-token.txt'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(directory, { recursive: true, force: true })
})

it('keeps the running Relay while saving a new selection, then reads the saved choice after restart', async () => {
  expect(getActiveSelfHostedRelayConfig(directory)?.relayDirectorUrl).toBe(
    'https://env-relay.example.com'
  )
  expect(
    saveSelfHostedRelaySettings(directory, {
      mode: 'self-hosted',
      origin: 'https://saved-relay.example.com',
      tokenFile: join(directory, 'saved-token.txt')
    })
  ).toEqual({
    selfHosted: true,
    origin: 'https://saved-relay.example.com',
    credentialName: 'saved-token.txt',
    restartRequired: true
  })
  expect(getActiveSelfHostedRelayConfig(directory)?.relayDirectorUrl).toBe(
    'https://env-relay.example.com'
  )

  vi.resetModules()
  const restarted = await import('./self-hosted-relay-preferences')
  expect(restarted.getActiveSelfHostedRelayConfig(directory)?.relayDirectorUrl).toBe(
    'https://saved-relay.example.com'
  )
  expect(restarted.getSelfHostedRelaySettings(directory).restartRequired).toBe(false)

  expect(
    restarted.saveSelfHostedRelaySettings(directory, { mode: 'official' }).restartRequired
  ).toBe(true)
  vi.resetModules()
  const reset = await import('./self-hosted-relay-preferences')
  expect(reset.getActiveSelfHostedRelayConfig(directory)).toBeUndefined()
})

it('treats a corrupted saved preference as an unavailable Relay instead of falling back', () => {
  mkdirSync(join(directory, 'mobile-relay'))
  writeFileSync(join(directory, 'mobile-relay', 'preference.json'), '{', 'utf8')

  expect(getActiveSelfHostedRelayConfig(directory)).toBeNull()
})
