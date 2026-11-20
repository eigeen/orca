import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { SettingsSwitchRow } from '../../form-controls/SettingsFormControls'
import { matchesSettingsSearch } from '../../search/settings-search'
import { translateSearchKeyword } from '../../search/settings-search-keywords'
import type { UsageHostSettingsModel } from './use-usage-host-settings'

export const getDirectQuotaQuerySearchEntry = createLocalizedCatalog(() => ({
  title: translate('settings.directQuotaQueries.label', 'Query other provider quotas'),
  description: translate(
    'settings.directQuotaQueries.description',
    'Allow the selected host to query quotas directly with your credentials. Claude is controlled separately.'
  ),
  keywords: [
    ...translateSearchKeyword('auto.components.settings.accounts.search.c759741d77', 'quota'),
    ...translateSearchKeyword('auto.components.settings.accounts.search.e949b08ffb', 'rate limit')
  ]
}))

export function renderOtherProviderQuotaSetting(
  usageHostSettings: UsageHostSettingsModel,
  isRemoteAccountScope: boolean,
  searchQuery: string
): React.JSX.Element | null {
  const enabled = usageHostSettings.settings?.directQuotaQueriesEnabled
  const searchEntry = getDirectQuotaQuerySearchEntry()
  if (
    (isRemoteAccountScope && typeof enabled !== 'boolean') ||
    !matchesSettingsSearch(searchQuery, searchEntry)
  ) {
    return null
  }
  return (
    <SettingsSwitchRow
      key="direct-quota-queries"
      label={searchEntry.title}
      description={searchEntry.description}
      checked={enabled === true}
      onChange={() =>
        void usageHostSettings.update({ directQuotaQueriesEnabled: enabled !== true })
      }
    />
  )
}
