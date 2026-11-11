import type { ProviderRateLimits } from '../../../shared/rate-limit-types'
// A null slot means loading to readers; a disabled meter must settle instead.
export function disabledUsageSnapshot(
  provider: ProviderRateLimits['provider'],
  now: number = Date.now()
): ProviderRateLimits {
  return {
    provider,
    session: null,
    weekly: null,
    updatedAt: now,
    error: null,
    status: 'idle'
  }
}

export function directQuotaDisabledSnapshot(
  provider: ProviderRateLimits['provider']
): ProviderRateLimits {
  return {
    ...disabledUsageSnapshot(provider),
    usageMetadata: { failureKind: 'direct-quota-disabled' }
  }
}
