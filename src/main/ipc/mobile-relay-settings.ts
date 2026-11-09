import { BrowserWindow, ipcMain } from 'electron'
import type { SelfHostedRelaySettingsResult } from '../../shared/remote-runtime/relay/self-hosted-relay-settings'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import {
  normalizeSelfHostedRelayOrigin,
  readSelfHostedRelayToken
} from '../runtime/mobile-cloud-relay/self-hosted-relay-config'
import {
  getSelfHostedRelaySettings,
  saveSelfHostedRelaySettings
} from '../runtime/mobile-cloud-relay/self-hosted-relay-preferences'
import { showSingleFlightOpenDialog } from './single-flight-open-dialog'
import { isTrustedUIRenderer } from './ui'

export function registerMobileRelaySettingsHandlers(): void {
  let saving = false
  ipcMain.handle('mobile:getRelaySettings', (event) => {
    if (!isTrustedUIRenderer(event.sender)) {
      throw new Error('Relay settings are available in the desktop settings window')
    }
    return getSelfHostedRelaySettings(getProfileUserDataPath())
  })
  ipcMain.handle(
    'mobile:saveRelaySettings',
    async (event, value: unknown): Promise<SelfHostedRelaySettingsResult> => {
      if (saving || !isTrustedUIRenderer(event.sender)) {
        return { status: 'save-failed' }
      }
      saving = true
      try {
        const directory = getProfileUserDataPath()
        if (value === null) {
          return {
            status: 'saved',
            settings: saveSelfHostedRelaySettings(directory, { mode: 'official' })
          }
        }
        const origin = normalizeSelfHostedRelayOrigin(value)
        if (!origin) {
          return { status: 'invalid-origin' }
        }
        const result = await showSingleFlightOpenDialog(
          { properties: ['openFile'] },
          BrowserWindow.fromWebContents(event.sender)
        )
        const tokenFile = result.filePaths[0]
        if (result.canceled || !tokenFile) {
          return { status: 'cancelled' }
        }
        // Only a native file selection may supply a path. Its contents never leave main.
        if (!(await readSelfHostedRelayToken(tokenFile).catch(() => null))) {
          return { status: 'invalid-credential' }
        }
        return {
          status: 'saved',
          settings: saveSelfHostedRelaySettings(directory, {
            mode: 'self-hosted',
            origin,
            tokenFile
          })
        }
      } catch {
        return { status: 'save-failed' }
      } finally {
        saving = false
      }
    }
  )
}
