/** With no build pin, the paired desktop supplies the Relay address per host. */
export function assertMobileRelayOrigin(
  origin: string,
  configured = process.env.EXPO_PUBLIC_ORCA_RELAY_ORIGIN
): void {
  if (configured === undefined) {
    return
  }
  const expected = new URL(configured.trim())
  if (
    expected.protocol !== 'https:' ||
    expected.href !== `${expected.origin}/` ||
    origin !== expected.origin
  ) {
    throw new Error('Relay address does not match this build')
  }
}
