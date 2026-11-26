<script setup lang="ts">
import {
  cancelCreditCardInstallmentPlan,
  createCreditCardInstallmentPlan,
  loadCreditCardInstallmentExposure,
  loadCreditCardInstallmentPlans,
  type CreditCardInstallmentPlan,
} from '@/api/credit-card-installments';
import { Button } from '@/components/lib/ui/button';
import { useNotificationCenter } from '@/components/notification-center';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type AccountModel } from '@bt/shared/types';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { toLocalCurrencyNumber } from '@/js/helpers';
import { getCurrencyDecimals } from '@/js/helpers/currency-decimals';

const props = defineProps<{ account: AccountModel }>();
const { t } = useI18n();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const queryClient = useQueryClient();
const queryKey = computed(() => ['credit-card-installment-plans', props.account.id]);
const exposureKey = computed(() => ['credit-card-installment-exposure', props.account.id]);
const today = new Date().toISOString().slice(0, 10);
const amountDecimals = computed(() => getCurrencyDecimals({ code: props.account.currencyCode, meta: props.account.currencyMeta }));
const amountStep = computed(() => String(10 ** -amountDecimals.value));
const form = reactive({
  description: '',
  purchaseDate: today,
  firstDueDate: today,
  totalAmount: '',
  installmentCount: '2',
});
const plansQuery = useQuery({
  queryKey,
  queryFn: () => loadCreditCardInstallmentPlans({ accountId: props.account.id }),
});
const exposureQuery = useQuery({
  queryKey: exposureKey,
  queryFn: () => loadCreditCardInstallmentExposure({ accountId: props.account.id }),
});
const createMutation = useMutation({
  mutationFn: createCreditCardInstallmentPlan,
  onSuccess: async () => {
    form.description = '';
    form.totalAmount = '';
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKey.value }),
      queryClient.invalidateQueries({ queryKey: exposureKey.value }),
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'credit-card-installment-exposure-dashboard' }),
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey as string[]).includes('transactionChange') }),
    ]);
    addSuccessNotification(t('pages.account.installments.created'));
  },
  onError: () => addErrorNotification(t('pages.account.installments.createError')),
});
const isSaving = computed(() => createMutation.isPending.value);
const cancelMutation = useMutation({
  mutationFn: cancelCreditCardInstallmentPlan,
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKey.value }),
      queryClient.invalidateQueries({ queryKey: exposureKey.value }),
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'credit-card-installment-exposure-dashboard' }),
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey as string[]).includes('transactionChange') }),
    ]);
    addSuccessNotification(t('pages.account.installments.cancelled'));
  },
  onError: () => addErrorNotification(t('pages.account.installments.cancelError')),
});
const canSubmit = computed(() =>
  form.description.trim().length > 0 &&
  Number(form.totalAmount) > 0 &&
  Number.isFinite(Number(form.totalAmount)) &&
  Number.isInteger(Number(form.installmentCount)) &&
  Number(form.installmentCount) >= 2 &&
  Number(form.installmentCount) <= 48 &&
  !!form.purchaseDate &&
  !!form.firstDueDate &&
  !isSaving.value,
);
const submit = () => {
  if (!canSubmit.value) return;
  createMutation.mutate({
    accountId: props.account.id,
    description: form.description.trim(),
    purchaseDate: form.purchaseDate,
    firstDueDate: form.firstDueDate,
    currencyCode: props.account.currencyCode,
    totalAmount: Number(form.totalAmount),
    installmentCount: Number(form.installmentCount),
  });
};
const formatAmount = (amount: number) => toLocalCurrencyNumber(amount, { currency: props.account.currencyCode, meta: props.account.currencyMeta });
const canCancel = (plan: CreditCardInstallmentPlan) =>
  plan.status === 'active' && !plan.installments.some((installment) => installment.status === 'posted');
</script>

<template>
  <section class="grid gap-5 py-6">
    <div class="grid gap-1">
      <h3 class="text-base font-semibold">{{ t('pages.account.installments.title') }}</h3>
      <p class="text-muted-foreground text-sm">{{ t('pages.account.installments.description') }}</p>
    </div>

    <div v-if="exposureQuery.data.value" class="grid grid-cols-2 gap-3 rounded-lg border p-4 sm:grid-cols-4">
      <div>
        <div class="text-muted-foreground text-xs">{{ t('pages.account.installments.limit') }}</div>
        <div class="text-sm font-semibold">{{ formatAmount(exposureQuery.data.value.creditLimit) }}</div>
      </div>
      <div>
        <div class="text-muted-foreground text-xs">{{ t('pages.account.installments.used') }}</div>
        <div class="text-sm font-semibold">{{ formatAmount(exposureQuery.data.value.usedCredit) }}</div>
      </div>
      <div>
        <div class="text-muted-foreground text-xs">{{ t('pages.account.installments.reserved') }}</div>
        <div class="text-sm font-semibold">{{ formatAmount(exposureQuery.data.value.reservedInstallments) }}</div>
      </div>
      <div>
        <div class="text-muted-foreground text-xs">{{ t('pages.account.installments.available') }}</div>
        <div class="text-sm font-semibold" :class="exposureQuery.data.value.overLimit ? 'text-app-expense-color' : ''">
          {{ formatAmount(exposureQuery.data.value.availableCredit) }}
        </div>
      </div>
    </div>
    <p v-else-if="exposureQuery.isError.value" class="text-muted-foreground text-sm">
      {{ t('pages.account.installments.exposureUnavailable') }}
    </p>

    <form class="grid gap-3 rounded-lg border p-4" @submit.prevent="submit">
      <h4 class="text-sm font-semibold">{{ t('pages.account.installments.newPlan') }}</h4>
      <label class="grid gap-1 text-sm">
        <span>{{ t('pages.account.installments.purchaseDescription') }}</span>
        <input v-model="form.description" maxlength="200" required class="bg-background border-input rounded-md border px-3 py-2" />
      </label>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">
          <span>{{ t('pages.account.installments.purchaseDate') }}</span>
          <input v-model="form.purchaseDate" type="date" required class="bg-background border-input rounded-md border px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span>{{ t('pages.account.installments.firstDueDate') }}</span>
          <input v-model="form.firstDueDate" type="date" required class="bg-background border-input rounded-md border px-3 py-2" />
        </label>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">
          <span>{{ t('pages.account.installments.totalAmount') }} ({{ props.account.currencyCode }})</span>
          <input v-model="form.totalAmount" type="number" :min="amountStep" :step="amountStep" required class="bg-background border-input rounded-md border px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span>{{ t('pages.account.installments.count') }}</span>
          <input v-model="form.installmentCount" type="number" min="2" max="48" step="1" required class="bg-background border-input rounded-md border px-3 py-2" />
        </label>
      </div>
      <div class="flex justify-end">
        <Button type="submit" :disabled="!canSubmit" :loading="isSaving">
          {{ t('pages.account.installments.create') }}
        </Button>
      </div>
    </form>

    <div class="grid gap-3">
      <h4 class="text-sm font-semibold">{{ t('pages.account.installments.history') }}</h4>
      <p v-if="plansQuery.isLoading.value" class="text-muted-foreground text-sm">{{ t('pages.account.installments.loading') }}</p>
      <p v-else-if="plansQuery.isError.value" class="text-muted-foreground text-sm">{{ t('pages.account.installments.loadError') }}</p>
      <p v-else-if="!plansQuery.data.value?.length" class="text-muted-foreground text-sm">{{ t('pages.account.installments.empty') }}</p>
      <article v-for="plan in plansQuery.data.value ?? []" :key="plan.id" class="grid gap-3 rounded-lg border p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-medium">{{ plan.description }}</div>
            <div class="text-muted-foreground text-xs">
              {{ plan.installmentCount }} {{ t('pages.account.installments.installments') }} · {{ formatAmount(plan.totalAmount) }}
            </div>
          </div>
          <Button
            v-if="canCancel(plan)"
            variant="outline"
            size="sm"
            :disabled="cancelMutation.isPending.value"
            @click="cancelMutation.mutate({ id: plan.id })"
          >
            {{ t('pages.account.installments.cancel') }}
          </Button>
        </div>
        <div class="grid gap-2">
          <div v-for="installment in plan.installments" :key="installment.id" class="flex items-center justify-between gap-2 text-sm">
            <span class="text-muted-foreground">
              {{ installment.installmentNumber }}/{{ plan.installmentCount }} · {{ installment.dueDate }}
            </span>
            <span class="flex items-center gap-2">
              {{ formatAmount(installment.amount) }}
              <span class="text-xs" :class="installment.status === 'posted' ? 'text-app-income-color' : 'text-muted-foreground'">
                {{ t('pages.account.installments.status.' + installment.status) }}
              </span>
            </span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
