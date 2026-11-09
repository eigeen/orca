import { useState } from 'react'
import { useAppStore } from '@/store'
import type { OrcaProfileAuthStatus } from '../../../../shared/orca-profiles'
import {
  resolveMobilePairingConnectionMode,
  type MobilePairingConnectionMode
} from '../../../../shared/remote-runtime/pairing/mobile-pairing-connection-mode'

export function selectMobileRelayAuthorized(state: {
  orcaProfileAuthStatus?: OrcaProfileAuthStatus | null
}): boolean {
  const status = state.orcaProfileAuthStatus
  return status?.selfHostedRelayOrigin !== undefined
    ? status.selfHostedRelayOrigin !== null
    : status?.state === 'connected'
}

/** Resolve persisted mode and sign-in consistently across MobilePage and MobilePane. */
export function useMobilePairingConnectionMode(): [
  MobilePairingConnectionMode,
  React.Dispatch<React.SetStateAction<MobilePairingConnectionMode>>
] {
  const savedConnectionMode = useAppStore((s) => s.settings?.mobilePairingConnectionMode)
  const signedIn = useAppStore(selectMobileRelayAuthorized)
  const [connectionMode, setConnectionMode] = useState<MobilePairingConnectionMode>(() =>
    resolveMobilePairingConnectionMode(savedConnectionMode, { signedIn })
  )
  const [resolvedFrom, setResolvedFrom] = useState({ savedConnectionMode, signedIn })
  if (
    resolvedFrom.savedConnectionMode !== savedConnectionMode ||
    resolvedFrom.signedIn !== signedIn
  ) {
    setResolvedFrom({ savedConnectionMode, signedIn })
    setConnectionMode(resolveMobilePairingConnectionMode(savedConnectionMode, { signedIn }))
  }
  return [connectionMode, setConnectionMode]
}
