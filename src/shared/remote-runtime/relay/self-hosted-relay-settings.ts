export type SelfHostedRelaySettings = {
  origin: string | null
  credentialName: string | null
  selfHosted: boolean
  restartRequired: boolean
}

export type SelfHostedRelaySettingsResult =
  | { status: 'saved'; settings: SelfHostedRelaySettings }
  | { status: 'cancelled' | 'invalid-origin' | 'invalid-credential' | 'save-failed' }
