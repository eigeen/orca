export function isLocalWindowsBuild(version: string): boolean {
  return process.platform === 'win32' && /-local\./.test(version)
}
