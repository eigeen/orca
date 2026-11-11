import { useEffect, useId, useState } from 'react'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type { SelfHostedRelaySettings } from '../../../../../shared/remote-runtime/relay/self-hosted-relay-settings'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'

type SettingsError = 'invalid-origin' | 'invalid-credential' | 'save-failed' | 'restart-failed'

function settingsErrorMessage(error: SettingsError, t: Translate): string {
  switch (error) {
    case 'invalid-origin':
      return t('settings.selfHostedRelay.invalidOrigin', 'Enter an HTTPS server address.')
    case 'invalid-credential':
      return t(
        'settings.selfHostedRelay.invalidCredential',
        'Select a valid Relay host token file.'
      )
    case 'restart-failed':
      return t(
        'settings.selfHostedRelay.restartFailed',
        'Could not restart Orca. Quit and reopen it to apply the setting.'
      )
    case 'save-failed':
      return t('settings.selfHostedRelay.saveFailed', 'Could not save Relay settings. Try again.')
  }
}

export function SelfHostedRelaySettingsSection(): React.JSX.Element | null {
  const t = useTranslate()
  const api = window.api?.mobile?.relaySettings
  const inputId = useId()
  const [settings, setSettings] = useState<SelfHostedRelaySettings | null>(null)
  const [origin, setOrigin] = useState('')
  const [error, setError] = useState<SettingsError | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    void api
      ?.get()
      .then((value) => {
        if (current) {
          setSettings(value)
          setOrigin(value.origin ?? '')
        }
      })
      .catch(() => {
        if (current) {
          setError('save-failed')
        }
      })
    return () => {
      current = false
    }
  }, [api])

  if (!api) {
    return null
  }

  const save = async (nextOrigin: string | null): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await api.save(nextOrigin).catch(() => ({ status: 'save-failed' as const }))
    setBusy(false)
    if (result.status === 'saved') {
      setSettings(result.settings)
      setOrigin(result.settings.origin ?? '')
    } else if (result.status !== 'cancelled') {
      setError(result.status)
    }
  }

  const restart = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.app.relaunch()
    } catch {
      setError('restart-failed')
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby={`${inputId}-heading`}>
      <h3 id={`${inputId}-heading`} className="text-sm font-semibold">
        {t('settings.selfHostedRelay.title', 'Self-hosted Relay')}
      </h3>
      <form
        className="space-y-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save(origin)
        }}
      >
        <Label htmlFor={inputId} variant="settings">
          {t('settings.selfHostedRelay.address', 'Relay HTTPS address')}
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={inputId}
            type="url"
            className="min-w-48 flex-1"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            aria-invalid={error === 'invalid-origin'}
            autoComplete="off"
            maxLength={2048}
            disabled={busy}
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !origin.trim()}>
            {t('settings.selfHostedRelay.chooseAndSave', 'Choose credential and save')}
          </Button>
        </div>
        {settings?.credentialName ? (
          <p className="break-all text-xs text-muted-foreground">{settings.credentialName}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {settingsErrorMessage(error, t)}
          </p>
        ) : null}
        {settings?.selfHosted ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void save(null)}
          >
            {t('settings.selfHostedRelay.useOfficial', 'Use Orca Relay')}
          </Button>
        ) : null}
      </form>
      {settings?.restartRequired ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-xs text-muted-foreground">
            {t('settings.selfHostedRelay.restartRequired', 'Restart Orca to apply Relay settings.')}
          </p>
          <Button size="sm" disabled={busy} onClick={() => void restart()}>
            {t('auto.components.settings.TerminalWindowSection.8abdab9f7c', 'Restart now')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
