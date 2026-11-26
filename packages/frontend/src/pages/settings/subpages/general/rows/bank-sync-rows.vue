<template>
  <SettingRow
    :label="$t('settings.general.manualTransferMatching.label')"
    :description="$t('settings.general.manualTransferMatching.description')"
    docs-path="/settings/general-settings/#match-transfers-with-manual-accounts"
  >
    <Switch
      :model-value="matchTransfersWithManualAccounts"
      :disabled="isUpdating"
      @update:model-value="handleManualTransferMatchingToggle"
    />
  </SettingRow>
</template>

<script setup lang="ts">
import { Switch } from '@/components/lib/ui/switch';
import { useNotificationCenter } from '@/components/notification-center';
import { useUserSettings } from '@/composable/data-queries/user-settings';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import SettingRow from './setting-row.vue';

const { t } = useI18n();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const { data: userSettings, mutateAsync, isUpdating } = useUserSettings();

const matchTransfersWithManualAccounts = computed(() => userSettings.value?.matchTransfersWithManualAccounts ?? false);

const handleManualTransferMatchingToggle = async (value: boolean) => {
  try {
    await mutateAsync({
      ...userSettings.value,
      matchTransfersWithManualAccounts: value,
    });
    addSuccessNotification(t('settings.general.manualTransferMatching.successNotification'));
  } catch {
    addErrorNotification(t('settings.general.manualTransferMatching.errorNotification'));
  }
};
</script>
