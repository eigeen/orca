import { app, powerMonitor } from 'electron'
import { getOrcaCloudAuthConfig } from '../orca-profiles/profile-cloud-auth-config'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import type { OrcaRuntimeRpcServer } from '../runtime/rpc/server/runtime-rpc'
import { DesktopRelayService } from '../runtime/mobile-cloud-relay/desktop-relay-service'
import { createDesktopRelayServiceInstaller } from '../runtime/mobile-cloud-relay/desktop-relay-service-installer'
import { getActiveSelfHostedRelayConfig } from '../runtime/mobile-cloud-relay/self-hosted-relay-preferences'
import { publishDesktopRelayStatus } from './main-process-relay-status'
import { mainProcessState as state } from './main-process-state'

// Register before proxy readiness; the installer waits before its first request.
export function startDesktopRelayService(runtimeRpc: OrcaRuntimeRpcServer): void {
  const installer = createDesktopRelayServiceInstaller({
    runtimeRpc,
    whenNetworkReady: state.initialProxyApplicationReady,
    isFenced: () => state.isQuitting,
    create: () => {
      const selfHosted = getActiveSelfHostedRelayConfig(getProfileUserDataPath())
      const cloudAuth = selfHosted === undefined ? getOrcaCloudAuthConfig() : null
      const authConfig = selfHosted ?? (cloudAuth?.configured ? cloudAuth.config : null)
      return authConfig
        ? new DesktopRelayService({
            authConfig,
            userDataPath: getProfileUserDataPath(),
            appVersion: app.getVersion(),
            runtimeRpc,
            onStatus: publishDesktopRelayStatus
          })
        : null
    },
    onInstalled: (service) => {
      state.desktopRelayService = service
    }
  })
  state.desktopRelayInstaller = installer
  runtimeRpc.setMobileRelayPairingProviderInstaller(() => installer.ensure())
  // Sleep can expire the token with no retry timer; resume is the recovery opportunity.
  powerMonitor.on('resume', () => state.desktopRelayService?.ensureLive())
  void installer.ensure()
}
