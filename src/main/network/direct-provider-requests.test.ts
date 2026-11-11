import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoogleIdentity } from '../antigravity/google-userinfo-identity'
import { fetchActiveClaudeRateLimits } from '../rate-limits/providers/claude/claude-active-usage-fetch'
import { fetchInactiveClaudeAccountUsage } from '../rate-limits/providers/claude/claude-managed-account-usage'
import { readClaudeOAuthCredentials } from '../rate-limits/providers/claude/claude-oauth-credentials'
import { fetchClaudeOAuthUsage } from '../rate-limits/providers/claude/claude-oauth-usage-request'
import {
  saveVerifiedOpenAiCompatibleSpeechProvider,
  saveVerifiedOpenAiSpeechApiKey
} from '../speech/openai-api-key-verification'
import { setMainHttpClient } from './http-client'

vi.mock('../rate-limits/providers/claude/claude-oauth-credentials', () => ({
  readClaudeOAuthCredentials: vi.fn(async () => ({
    token: 'synthetic-claude-token',
    hasRefreshableCredentials: true,
    source: 'credentials-file'
  })),
  resolveClaudeOAuthCredentialReadOptions: vi.fn()
}))

afterEach(() => {
  setMainHttpClient(null)
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('direct provider requests', () => {
  it('settles Claude usage without reading credentials or contacting Anthropic', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 403 }))
    setMainHttpClient({ fetch, proxySession: () => null })

    const noUsage = { provider: 'claude', session: null, weekly: null, status: 'idle' }
    await expect(fetchActiveClaudeRateLimits()).resolves.toMatchObject(noUsage)
    await expect(
      fetchInactiveClaudeAccountUsage({ id: 'inactive-account' })
    ).resolves.toMatchObject(noUsage)
    await expect(fetchClaudeOAuthUsage('synthetic-claude-token')).rejects.toThrow(/disabled/)
    expect(readClaudeOAuthCredentials).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads Claude quota after opt-in and stops when the opt-in is removed', async () => {
    const fetch = vi.fn(async () => Response.json({ five_hour: { utilization: 37 } }))
    setMainHttpClient({ fetch, proxySession: () => null })

    await expect(
      fetchActiveClaudeRateLimits({ allowDirectQuotaQueries: true })
    ).resolves.toMatchObject({
      provider: 'claude',
      status: 'ok',
      session: { usedPercent: 37 }
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/api/oauth/usage',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer synthetic-claude-token' })
      })
    )
    fetch.mockClear()

    await expect(
      fetchActiveClaudeRateLimits({ allowDirectQuotaQueries: false })
    ).resolves.toMatchObject({
      status: 'idle',
      session: null
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('blocks account identity lookup and cloud dictation key validation before network access', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 401 }))
    setMainHttpClient({ fetch, proxySession: () => null })
    vi.stubGlobal('fetch', fetch)

    await expect(fetchGoogleIdentity('synthetic-google-token')).rejects.toThrow(/disabled/)
    await expect(saveVerifiedOpenAiSpeechApiKey('synthetic-openai-key')).rejects.toThrow(/disabled/)
    await expect(
      saveVerifiedOpenAiCompatibleSpeechProvider({
        baseUrl: 'https://speech.example.test/v1',
        model: 'synthetic-model',
        apiKey: 'synthetic-speech-key'
      })
    ).rejects.toThrow(/disabled/)
    expect(fetch).not.toHaveBeenCalled()
  })
})
