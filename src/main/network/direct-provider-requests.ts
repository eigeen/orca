// Vendor credentials stay with the agent CLI in this build.
export const DIRECT_PROVIDER_REQUESTS_ENABLED = false
export const DIRECT_PROVIDER_REQUESTS_DISABLED =
  'Direct provider requests are disabled in this build.'

export function requireDirectProviderRequests(): void {
  if (!DIRECT_PROVIDER_REQUESTS_ENABLED) {
    throw new Error(DIRECT_PROVIDER_REQUESTS_DISABLED)
  }
}
