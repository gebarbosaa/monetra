<script setup lang="ts">
import {
  cancelCreditCardInstallmentPlan,
  createCreditCardInstallmentPlan,
  loadCreditCardInstallmentExposure,
  loadCreditCardInstallmentPlans,
  linkCreditCardInstallmentTransaction,
  updateCreditCardInstallmentPlan,
  type CreditCardInstallment,
  type CreditCardInstallmentPlan,
} from '@/api/credit-card-installments';
import { loadTransactions } from '@/api/transactions';
import { Button } from '@/components/lib/ui/button';
import CategorySelectField from '@/components/fields/category-select-field.vue';
import { useAccountCategories } from '@/composable/data-queries/categories';
import { useNotificationCenter } from '@/components/notification-center';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type AccountModel, TRANSACTION_TYPES, type TransactionModel } from '@bt/shared/types';
import type { FormattedCategory } from '@/common/types';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { format } from 'date-fns';
import { toLocalCurrencyNumber } from '@/js/helpers';
import { getCurrencyDecimals } from '@/js/helpers/currency-decimals';

const props = defineProps<{ account: AccountModel }>();
const { t } = useI18n();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const queryClient = useQueryClient();
const categories = useAccountCategories({ accountId: computed(() => props.account.id) });
const selectedCategory = ref<FormattedCategory | null>(null);
const editingPlanId = ref<string | null>(null);
const editingCategory = ref<FormattedCategory | null>(null);
const editForm = reactive({ description: '', purchaseDate: '', firstDueDate: '' });
const selectedTransactions = reactive<Record<string, string>>({});
const queryKey = computed(() => ['credit-card-installment-plans', props.account.id]);
const exposureKey = computed(() => ['credit-card-installment-exposure', props.account.id]);
const today = format(new Date(), 'yyyy-MM-dd');
const amountDecimals = computed(() =>
  getCurrencyDecimals({ code: props.account.currencyCode, meta: props.account.currencyMeta }),
);
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
const candidateTransactionsQuery = useQuery({
  queryKey: computed(() => ['credit-card-installment-reconciliation-candidates', props.account.id]),
  queryFn: () => loadTransactions({
    accountIds: [props.account.id],
    transactionType: TRANSACTION_TYPES.expense,
    isPlanned: false,
    limit: 100,
    offset: 0,
  }),
  enabled: computed(() =>
    (plansQuery.data.value ?? []).some((plan) => plan.installments.some((installment) => installment.status === 'planned')),
  ),
  staleTime: 30_000,
});
const linkedTransactionIds = computed(() =>
  new Set(
    (plansQuery.data.value ?? []).flatMap((plan) =>
      plan.installments
        .filter((installment) => installment.status === 'posted' && installment.transactionId)
        .map((installment) => installment.transactionId as string),
    ),
  ),
);
const matchingTransactions = (installment: CreditCardInstallment) =>
  (candidateTransactionsQuery.data.value ?? []).filter((transaction: TransactionModel) =>
    !linkedTransactionIds.value.has(transaction.id) &&
    Math.abs(Math.abs(Number(transaction.amount)) - Number(installment.amount)) < 1e-8,
  );
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
const updateMutation = useMutation({
  mutationFn: updateCreditCardInstallmentPlan,
  onSuccess: async () => {
    editingPlanId.value = null;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKey.value }),
      queryClient.invalidateQueries({ queryKey: exposureKey.value }),
      queryClient.invalidateQueries({ queryKey: ['credit-card-installment-exposure-dashboard'] }),
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey as string[]).includes('transactionChange') }),
    ]);
    addSuccessNotification(t('pages.account.installments.updated'));
  },
  onError: () => addErrorNotification(t('pages.account.installments.updateError')),
});
const beginEdit = (plan: CreditCardInstallmentPlan) => {
  editingPlanId.value = plan.id;
  editForm.description = plan.description;
  editForm.purchaseDate = plan.purchaseDate;
  editForm.firstDueDate = plan.installments[0]?.dueDate ?? plan.purchaseDate;
  editingCategory.value = categories.formatted.value.find((category) => category.id === plan.categoryId) ?? null;
};
const submitEdit = (planId: string) => {
  if (
    !editForm.description.trim() ||
    !editingCategory.value ||
    !editForm.purchaseDate ||
    !editForm.firstDueDate ||
    editForm.firstDueDate < editForm.purchaseDate
  ) return;
  updateMutation.mutate({
    id: planId,
    description: editForm.description.trim(),
    categoryId: editingCategory.value.id,
    purchaseDate: editForm.purchaseDate,
    firstDueDate: editForm.firstDueDate,
  });
};
const canEdit = (plan: CreditCardInstallmentPlan) =>
  plan.status === 'active' && plan.installments.length === plan.installmentCount &&
  plan.installments.every((installment) => installment.status === 'planned');
const linkMutation = useMutation({
  mutationFn: linkCreditCardInstallmentTransaction,
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKey.value }),
      queryClient.invalidateQueries({ queryKey: exposureKey.value }),
      queryClient.invalidateQueries({ queryKey: ['credit-card-installment-exposure-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['credit-card-installment-reconciliation-candidates', props.account.id] }),
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey as string[]).includes('transactionChange') }),
    ]);
    addSuccessNotification(t('pages.account.installments.linked'));
  },
  onError: () => addErrorNotification(t('pages.account.installments.linkError')),
});
const linkSelectedTransaction = (planId: string, installmentId: string) => {
  const transactionId = selectedTransactions[installmentId];
  if (!transactionId) return;
  linkMutation.mutate({ planId, installmentId, transactionId });
};
const canSubmit = computed(() =>
  form.description.trim().length > 0 &&
  !!selectedCategory.value &&
  Number(form.totalAmount) > 0 &&
  Number.isFinite(Number(form.totalAmount)) &&
  Number.isInteger(Number(form.installmentCount)) &&
  Number(form.installmentCount) >= 2 &&
  Number(form.installmentCount) <= 48 &&
  !!form.purchaseDate &&
  !!form.firstDueDate &&
  form.firstDueDate >= form.purchaseDate &&
  !isSaving.value,
);
const submit = () => {
  if (!canSubmit.value) return;
  createMutation.mutate({
    accountId: props.account.id,
    description: form.description.trim(),
    categoryId: selectedCategory.value!.id,
    purchaseDate: form.purchaseDate,
    firstDueDate: form.firstDueDate,
    currencyCode: props.account.currencyCode,
    totalAmount: Number(form.totalAmount),
    installmentCount: Number(form.installmentCount),
  });
};
const formatAmount = (amount: number) =>
  toLocalCurrencyNumber(amount, { currency: props.account.currencyCode, meta: props.account.currencyMeta });
const formatTransactionDate = (value: Date | string) => format(new Date(value), 'dd/MM/yyyy');
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
      <div class="grid gap-1">
        <span class="text-sm">{{ t('pages.account.installments.category') }}</span>
        <CategorySelectField
          v-model="selectedCategory"
          :values="categories.formatted.value"
          :categories-map="categories.map.value"
          :placeholder="t('pages.account.installments.categoryPlaceholder')"
          :disabled="categories.isLoading.value"
        />
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">
          <span>{{ t('pages.account.installments.purchaseDate') }}</span>
          <input v-model="form.purchaseDate" type="date" :max="form.firstDueDate || undefined" required class="bg-background border-input rounded-md border px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span>{{ t('pages.account.installments.firstDueDate') }}</span>
          <input v-model="form.firstDueDate" type="date" :min="form.purchaseDate || undefined" required class="bg-background border-input rounded-md border px-3 py-2" />
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
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="canEdit(plan)"
              variant="outline"
              size="sm"
              :disabled="updateMutation.isPending.value"
              @click="beginEdit(plan)"
            >
              {{ t('pages.account.installments.edit') }}
            </Button>
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
        </div>
        <form
          v-if="editingPlanId === plan.id"
          class="grid gap-3 rounded-md border border-dashed p-3"
          @submit.prevent="submitEdit(plan.id)"
        >
          <label class="grid gap-1 text-sm">
            <span>{{ t('pages.account.installments.purchaseDescription') }}</span>
            <input v-model="editForm.description" maxlength="200" required class="bg-background border-input rounded-md border px-3 py-2" />
          </label>
          <div class="grid gap-1">
            <span class="text-sm">{{ t('pages.account.installments.category') }}</span>
            <CategorySelectField
              v-model="editingCategory"
              :values="categories.formatted.value"
              :categories-map="categories.map.value"
              :placeholder="t('pages.account.installments.categoryPlaceholder')"
              :disabled="categories.isLoading.value || updateMutation.isPending.value"
            />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-1 text-sm">
              <span>{{ t('pages.account.installments.purchaseDate') }}</span>
              <input v-model="editForm.purchaseDate" type="date" :max="editForm.firstDueDate || undefined" required class="bg-background border-input rounded-md border px-3 py-2" />
            </label>
            <label class="grid gap-1 text-sm">
              <span>{{ t('pages.account.installments.firstDueDate') }}</span>
              <input v-model="editForm.firstDueDate" type="date" :min="editForm.purchaseDate || undefined" required class="bg-background border-input rounded-md border px-3 py-2" />
            </label>
          </div>
          <div class="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" :disabled="updateMutation.isPending.value" @click="editingPlanId = null">
              {{ t('pages.account.installments.dismiss') }}
            </Button>
            <Button type="submit" size="sm" :disabled="updateMutation.isPending.value || !editingCategory || !editForm.description.trim() || !editForm.purchaseDate || !editForm.firstDueDate || editForm.firstDueDate < editForm.purchaseDate" :loading="updateMutation.isPending.value">
              {{ t('pages.account.installments.saveChanges') }}
            </Button>
          </div>
        </form>
        <div class="grid gap-2">
          <div v-for="installment in plan.installments" :key="installment.id" class="grid gap-2 rounded-md border border-dashed p-3 text-sm">
            <div class="flex items-center justify-between gap-2">
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
            <div v-if="installment.status === 'planned'" class="flex flex-wrap items-center gap-2">
              <select
                v-model="selectedTransactions[installment.id]"
                class="bg-background border-input min-w-0 flex-1 rounded-md border px-2 py-2 text-xs"
                :disabled="candidateTransactionsQuery.isLoading.value || linkMutation.isPending.value"
              >
                <option value="">{{ t('pages.account.installments.selectTransaction') }}</option>
                <option
                  v-for="candidate in matchingTransactions(installment)"
                  :key="candidate.id"
                  :value="candidate.id"
                >
                  {{ formatTransactionDate(candidate.time) }} · {{ candidate.note || t('pages.account.installments.unnamedTransaction') }} · {{ formatAmount(candidate.amount) }}
                </option>
              </select>
              <Button
                size="sm"
                variant="outline"
                :disabled="!selectedTransactions[installment.id] || linkMutation.isPending.value"
                @click="linkSelectedTransaction(plan.id, installment.id)"
              >
                {{ t('pages.account.installments.link') }}
              </Button>
            </div>
            <p
              v-if="installment.status === 'planned' && candidateTransactionsQuery.isError.value"
              class="text-muted-foreground text-xs"
            >
              {{ t('pages.account.installments.candidateLoadError') }}
            </p>
            <p
              v-else-if="installment.status === 'planned' && !candidateTransactionsQuery.isLoading.value && matchingTransactions(installment).length === 0"
              class="text-muted-foreground text-xs"
            >
              {{ t('pages.account.installments.noMatchingTransactions') }}
            </p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
