import type { MobilePairingConnectionMode } from '../../../../shared/remote-runtime/pairing/mobile-pairing-connection-mode'
import type { MobileRelayMintFailure } from '../../../../shared/remote-runtime/relay/mobile-relay-mint-failure'

export function formatRelayMintDiagnostics(
  preferredConnectionMode: MobilePairingConnectionMode,
  failure: MobileRelayMintFailure,
  selectedAddress?: string | null
): string {
  return JSON.stringify(
    {
      kind: 'mobile_pairing_relay_failure',
      preferredConnectionMode,
      failure,
      selectedAddress: selectedAddress ?? null,
      at: new Date().toISOString()
    },
    null,
    2
  )
}
