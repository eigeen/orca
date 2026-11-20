import type { NetworkProxySettings } from '../../../../shared/network/network-proxy'
import type { UsageReadingAccount } from '../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { DirectQuotaQueryOptions } from '../../direct-quota-query-options'

export type CodexRateLimitFetchOptions = DirectQuotaQueryOptions & {
  codexHomePath?: string | null
  /** The saved account that owns `codexHomePath`; named on a successful reading. */
  readingAccount?: UsageReadingAccount
  networkProxySettings?: NetworkProxySettings
}
