import { app } from 'electron'
import { isLocalWindowsBuild } from '../startup/local-windows-build'

export function isPackagedUpdateEnabled(): boolean {
  // A Windows local installer is updated by rebuilding it from its own source.
  return app.isPackaged && !isLocalWindowsBuild(app.getVersion())
}
