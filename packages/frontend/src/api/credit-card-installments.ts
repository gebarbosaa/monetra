import { api } from '@/api/_api';

export type CreditCardInstallmentStatus = 'planned' | 'posted' | 'cancelled';
export type CreditCardInstallmentPlanStatus = 'active' | 'cancelled';

export interface CreditCardInstallment {
  id: string;
  planId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  refAmount: number;
  transactionId: string | null;
  status: CreditCardInstallmentStatus;
}

export interface CreditCardInstallmentPlan {
  id: string;
  userId: number;
  accountId: string;
  description: string;
  categoryId: string | null;
  purchaseDate: string;
  currencyCode: string;
  totalAmount: number;
  refTotalAmount: number;
  installmentCount: number;
  status: CreditCardInstallmentPlanStatus;
  installments: CreditCardInstallment[];
}

export interface CreditCardInstallmentExposure {
  accountId: string;
  creditLimit: number;
  currentBalance: number;
  usedCredit: number;
  reservedInstallments: number;
  availableCredit: number;
  overLimit: boolean;
  refCreditLimit: number;
  refUsedCredit: number;
  refReservedInstallments: number;
  refAvailableCredit: number;
  refOverLimit: boolean;
}

export interface CreateCreditCardInstallmentPlanPayload {
  accountId: string;
  description: string;
  categoryId: string;
  purchaseDate: string;
  firstDueDate: string;
  currencyCode: string;
  totalAmount: number;
  installmentCount: number;
}

export const loadCreditCardInstallmentPlans = async ({
  accountId,
}: {
  accountId?: string;
} = {}): Promise<CreditCardInstallmentPlan[]> => {
  return api.get('/credit-card-installments', accountId ? { accountId } : undefined);
};

export const createCreditCardInstallmentPlan = async (
  payload: CreateCreditCardInstallmentPlanPayload,
): Promise<CreditCardInstallmentPlan> => {
  return api.post('/credit-card-installments', payload);
};

export const cancelCreditCardInstallmentPlan = async ({ id }: { id: string }) => {
  return api.delete(`/credit-card-installments/${id}`);
};

export const linkCreditCardInstallmentTransaction = async ({
  planId,
  installmentId,
  transactionId,
}: {
  planId: string;
  installmentId: string;
  transactionId: string;
}): Promise<CreditCardInstallment> => {
  return api.post(
    `/credit-card-installments/${planId}/installments/${installmentId}/link`,
    { transactionId },
  );
};

export const loadCreditCardInstallmentExposure = async ({
  accountId,
}: {
  accountId: string;
}): Promise<CreditCardInstallmentExposure> => {
  return api.get(`/credit-card-installments/accounts/${accountId}/exposure`);
};
