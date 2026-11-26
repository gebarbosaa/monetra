# MONETRA — Auditoria de integridade financeira

Data da revisão: 2026-11-26  
Branch revisada: `dev`  
Commit-base observado: `b3df1ff862fd16381d555fdbe1429ed0c299bca7`

## Escopo desta revisão

Esta é uma auditoria estática do código e dos testes presentes no repositório. Não representa execução de testes, validação em banco de dados ou homologação ponta a ponta.

## Evidências encontradas

### 1. Pagamentos distribuídos entre contas

O serviço `packages/backend/src/services/transactions/payment-legs/sync-payment-legs.ts` implementa linhas de pagamento vinculadas à transação principal. A suíte `payment-legs.e2e.ts` cobre criação de linhas, atualização, remoção, preservação de tags, restrições de edição e efeitos nos saldos.

**Limite da evidência:** pagamentos distribuídos entre contas não comprovam, por si só, que a liquidação de uma fatura de cartão nunca será contabilizada como uma segunda despesa. Esse cenário precisa de teste específico.

### 2. Limite de crédito nos indicadores

`packages/backend/src/services/stats/get-credit-limit-adjustment.ts` calcula o ajuste por conta usando `refCreditLimit` na moeda-base, respeitando o escopo de contas e `excludeFromStats`.

A suíte `credit-limit-in-stats.e2e.ts` cobre:
- ativação e desativação da opção de incluir limite nos indicadores;
- exclusão de contas sem limite positivo;
- respeito a `excludeFromStats`;
- conversão de limite de conta em moeda estrangeira para a moeda-base;
- histórico consolidado de saldos.

**Limite da evidência:** isso valida o ajuste de limite nos indicadores, não a regra completa de limite disponível considerando compras parceladas futuras e parcelas já liquidadas.

### 3. Limite disponível e compras parceladas no cartão

A leitura dos modelos e serviços atuais encontrou estas distinções:

- `Accounts` armazena `creditLimit` e `refCreditLimit` como valores do limite total configurado e sua conversão para a moeda-base.
- `get-credit-limit-adjustment.ts` usa `refCreditLimit` para ajustar indicadores patrimoniais. Esse serviço não soma compras parceladas nem calcula o saldo de parcelas futuras.
- `Transactions` armazena valores, tipo, conta, transferência e vínculo de pagamento; na definição do modelo consultada não há campos dedicados de quantidade de parcelas, valor de parcela, parcela atual ou saldo futuro parcelado.
- `services/subscriptions/installments.ts` controla parcelas de assinaturas/compromissos recorrentes (`maxOccurrences`, períodos pagos/pulados e conclusão). Não é evidência de um razão de compras parceladas no cartão.

**Conclusão desta auditoria:** não foi localizada uma implementação explícita que calcule o limite disponível do cartão subtraindo o saldo futuro de compras parceladas. Não é seguro tentar corrigir isso alterando `get-credit-limit-adjustment.ts`, pois ele serve a outro propósito (indicadores patrimoniais).

**Decisão técnica:** antes de implementar o cálculo, é necessário definir/adotar uma fonte de verdade para compras parceladas (compra original, número de parcelas, valor de cada parcela, parcelas liquidadas, estornos/cancelamentos e conta/cartão associado). O cálculo deve reservar somente parcelas ainda não liquidadas e liberar o limite quando uma parcela for paga, estornada ou cancelada, sem criar uma segunda despesa no pagamento da fatura.
### 3. Seleção de animais nas transações

O utilitário de seleção de tags foi endurecido para aceitar como animal somente IDs com marcador `MONETRA_PET:`. Tags comuns e IDs inexistentes não são mais anexados como seleção de animal. Foram adicionados casos de regressão em `pet-tag-selection.spec.ts`.

## Pontos que continuam em aberto

1. **Teste de regressão adicionado** em `matching-transactions.e2e.ts`: compra de R$ 500 no cartão seguida de pagamento da fatura entre contas; espera R$ 500 em despesas e R$ 500 em transferências, sem duplicar a despesa. Ainda falta executar o teste.
2. Projetar e implementar um razão explícito de compras parceladas no cartão e o cálculo do limite disponível, cobrindo parcelas futuras, liquidadas, estornos e cancelamentos; a fonte de verdade ainda não foi localizada.
3. Validar transferências internas para garantir que não sejam somadas como receita ou despesa nos relatórios familiares.
4. Verificar a exclusão de `GRANA EXTRA` no ranking Top 15, sem ocultar os lançamentos do razão financeiro.
5. Revisar idempotência de lançamentos recorrentes e trilha de auditoria das alterações relevantes.
6. Confirmar que relatórios, saldos e categorias usam a unidade familiar consolidada, sem rateio automático por pessoa.

## Estado de validação

- Alteração do seletor de animais: gravada na branch `dev`, com teste de regressão adicionado.
- Testes automatizados: **não executados nesta sessão**; o novo caso está no arquivo E2E, mas o acesso ao repositório nesta sessão não disponibiliza um runner para executar Jest.
- GitHub Actions: a consulta de execuções da branch `dev` não retornou execuções.
- Deploy: não iniciado.

## Próxima ação recomendada

Definir a modelagem de compras parceladas e limite disponível antes de alterar cálculos existentes. Em paralelo, executar os testes E2E adicionados para pagamento de fatura e verificar os fluxos de transferência/relatórios. Não alterar regras financeiras sem confirmar o comportamento atual e os modelos envolvidos.
