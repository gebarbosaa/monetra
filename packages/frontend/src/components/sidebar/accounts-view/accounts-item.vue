<script setup lang="ts">
import AccountLogo from '@/components/common/account-logo.vue';
import Button from '@/components/lib/ui/button/Button.vue';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { useAccountAccess } from '@/composable/use-account-access';
import { useAccountDisplayBalance } from '@/composable/use-account-display-balance';
import { formatAccountAmount, formatCompactUIAmount } from '@/js/helpers';
import { ROUTES_NAMES } from '@/routes/constants';
import { AccountModel } from '@bt/shared/types';
import { HomeIcon, UsersIcon } from '@lucide/vue';
import { toRef } from 'vue';

const props = defineProps<{
  account: AccountModel;
}>();

const { displayBalance } = useAccountDisplayBalance({ account: toRef(() => props.account) });

const { isSharedWithCaller, ownerHandle, isHouseholdGranted } = useAccountAccess(toRef(() => props.account));

</script>

<template>
  <router-link
    v-slot="{ isActive }"
    :to="{ name: ROUTES_NAMES.account, params: { id: account.id } }"
    class="flex w-full"
  >
    <Button :variant="isActive ? 'secondary' : 'ghost'" as="div" size="default" class="h-auto w-full px-2">
      <div class="flex w-full items-center justify-between gap-x-2">
        <div class="flex min-w-0 items-center gap-1.5">
          <DesktopOnlyTooltip
            v-if="isSharedWithCaller"
            :content="
              isHouseholdGranted
                ? $t('sidebar.accountsView.viaHousehold', { handle: `@${ownerHandle}` })
                : $t('sidebar.accountsView.sharedBy', { handle: `@${ownerHandle}` })
            "
          >
            <component
              :is="isHouseholdGranted ? HomeIcon : UsersIcon"
              class="text-muted-foreground size-3.5 shrink-0"
            />
          </DesktopOnlyTooltip>
          <AccountLogo :account="account" class="size-5 shrink-0 rounded-md" />
          <span class="truncate text-sm">{{ account.name }}</span>
        </div>
        <DesktopOnlyTooltip :content="formatAccountAmount({ amount: displayBalance, account, fullPrecision: true })">
          <span class="text-amount shrink-0 text-sm font-medium" :class="displayBalance < 0 && 'text-destructive-text'">
            {{
              formatCompactUIAmount({
                amount: displayBalance,
                currency: account.currencyCode,
                meta: account.currencyMeta,
              })
            }}
          </span>
        </DesktopOnlyTooltip>
      </div>
    </Button>
  </router-link>
</template>
