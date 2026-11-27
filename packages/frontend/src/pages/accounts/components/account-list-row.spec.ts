import { registerCurrencyDecimals, resetCurrencyDecimals } from '@/js/helpers/currency-decimals';
import { useCurrenciesStore } from '@/stores/currencies';
import { ACCOUNT_CATEGORIES, type AccountModel } from '@bt/shared/types';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import AccountListRow from './account-list-row.vue';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock('@/composable', () => ({
  useFormatCurrency: () => ({ formatAccountAmount: () => '0', formatBaseCurrency: () => '0' }),
}));
vi.mock('@/composable/use-account-display-balance', () => ({
  useAccountDisplayBalance: () => ({ displayBalance: ref(0), displayRefBalance: ref(0) }),
}));

const buildAccount = ({ currencyCode, bankLinked = false }: { currencyCode: string; bankLinked?: boolean }) =>
  ({
    id: 'account-1',
    name: 'Savings',
    currencyCode,
    bankDataProviderConnectionId: bankLinked ? 'legacy-connection' : null,
    accountCategory: ACCOUNT_CATEGORIES.general,
    refCurrentBalance: 0,
  }) as unknown as AccountModel;

const mountRow = ({ currencyCode, bankLinked = false }: { currencyCode: string; bankLinked?: boolean }) => {
  const pinia = createPinia();
  setActivePinia(pinia);
  useCurrenciesStore();

  return mount(AccountListRow, {
    props: { account: buildAccount({ currencyCode, bankLinked }) },
    global: {
      plugins: [pinia],
      stubs: { RouterLink: { template: '<a><slot /></a>' }, AccountLogo: true, DesktopOnlyTooltip: true },
      mocks: { $t: (key: string) => key },
    },
  });
};

describe('AccountListRow currency icon', () => {
  beforeEach(() => {
    resetCurrencyDecimals();
    registerCurrencyDecimals({ entries: [{ code: 'BTC', decimals: 8, isCustom: true, symbol: '₿' }] });
  });

  it('shows the flag of an ISO currency before the code', () => {
    const wrapper = mountRow({ currencyCode: 'USD' });

    expect(wrapper.find('img').attributes('src')).toBe('https://wise.com/web-art/assets/flags/usd.svg');
  });

  it('shows the monogram of a custom currency instead of hiding the icon', () => {
    const wrapper = mountRow({ currencyCode: 'BTC' });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('[data-testid="currency-icon-monogram"]').text()).toBe('₿');
  });
});

describe('AccountListRow manual-only presentation', () => {
  it('does not show provider reauthorization warnings for legacy linked accounts', () => {
    const wrapper = mountRow({ currencyCode: 'BRL', bankLinked: true });

    expect(wrapper.text()).not.toContain('sidebar.accountsView.needsReauthTooltip');
  });
});
