import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoogleIdentity } from '../antigravity/google-userinfo-identity'
import { fetchClaudeRateLimits, fetchManagedAccountUsage } from '../rate-limits/claude-fetcher'
import { readClaudeOAuthCredentials } from '../rate-limits/claude-oauth-credentials'
import { fetchClaudeOAuthUsage } from '../rate-limits/claude-oauth-usage-request'
import { saveVerifiedOpenAiSpeechApiKey } from '../speech/openai-api-key-verification'
import { setMainHttpClient } from './http-client'

vi.mock('../rate-limits/claude-oauth-credentials', () => ({
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
    await expect(fetchClaudeRateLimits()).resolves.toMatchObject(noUsage)
    await expect(fetchManagedAccountUsage({ id: 'inactive-account' })).resolves.toMatchObject(
      noUsage
    )
    await expect(fetchClaudeOAuthUsage('synthetic-claude-token')).rejects.toThrow(/disabled/)
    expect(readClaudeOAuthCredentials).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads Claude quota after opt-in and stops when the opt-in is removed', async () => {
    const fetch = vi.fn(async () => Response.json({ five_hour: { utilization: 37 } }))
    setMainHttpClient({ fetch, proxySession: () => null })

    await expect(fetchClaudeRateLimits({ allowDirectQuotaQueries: true })).resolves.toMatchObject({
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

    await expect(fetchClaudeRateLimits({ allowDirectQuotaQueries: false })).resolves.toMatchObject({
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
    expect(fetch).not.toHaveBeenCalled()
  })
})
