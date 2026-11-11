import type { NetworkProxySettings } from '../../../../shared/network-proxy'
import type { DirectQuotaQueryOptions } from '../../direct-quota-query-options'

export type CodexRateLimitFetchOptions = DirectQuotaQueryOptions & {
  codexHomePath?: string | null
  networkProxySettings?: NetworkProxySettings
}
