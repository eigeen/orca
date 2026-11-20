import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoogleIdentity } from '../antigravity/google-userinfo-identity'
import {
  saveVerifiedOpenAiCompatibleSpeechProvider,
  saveVerifiedOpenAiSpeechApiKey
} from '../speech/openai-api-key-verification'
import { setMainHttpClient } from './http-client'

afterEach(() => {
  setMainHttpClient(null)
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('direct provider requests', () => {
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
