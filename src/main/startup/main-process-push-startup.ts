import { getOrcaPushGatewayUrl } from '../orca-profiles/profile-cloud-auth-config'
import { DesktopPushService } from '../runtime/push/desktop-push-service'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { OrcaRuntimeRpcServer } from '../runtime/rpc/server/runtime-rpc'
import { getSelfHostedRelayConfig } from '../runtime/mobile-cloud-relay/self-hosted-relay-config'
import { mainProcessState as state } from './main-process-state'

// Push authenticates by host keypair, so accountless hosts must register phones too; shared startup state supplies the runtime in both modes.
export function startDesktopPushService(runtimeRpc: OrcaRuntimeRpcServer): void {
  if (getSelfHostedRelayConfig() !== undefined) {
    return
  }
  const runtime: OrcaRuntimeService | null = state.runtime
  if (!runtime) {
    console.warn('[push] Background push startup skipped: runtime not started')
    return
  }
  try {
    const pushService = DesktopPushService.create({
      runtime,
      runtimeRpc,
      gatewayUrl: getOrcaPushGatewayUrl()
    })
    pushService?.start()
    state.desktopPushService = pushService
  } catch (error) {
    console.warn(
      '[push] Background push startup unavailable:',
      error instanceof Error ? error.message : String(error)
    )
  }
}
