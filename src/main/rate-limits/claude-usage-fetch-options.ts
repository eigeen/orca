import type { NetworkProxySettings } from '../../shared/network-proxy'
import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth-service'
import type { DirectQuotaQueryOptions } from './direct-quota-query-options'

export type ClaudeRateLimitFetchOptions = DirectQuotaQueryOptions & {
  authPreparation?: ClaudeRuntimeAuthPreparation
  allowPtyFallback?: boolean
  allowUsagePanelSupplement?: boolean
  networkProxySettings?: NetworkProxySettings
}

export type ClaudeManagedAccountUsageOptions = DirectQuotaQueryOptions & {
  allowUsagePanelSupplement?: boolean
  networkProxySettings?: NetworkProxySettings
}
