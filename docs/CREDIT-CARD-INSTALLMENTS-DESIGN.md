# MONETRA — Projeto técnico: compras parceladas e limite disponível

Status: implementação parcial — persistência e API inicial; integração de interface e automação pendentes  
Branch de referência: `dev`  
Data: 2026-11-26

## Objetivo

Calcular a utilização e o limite disponível de cartões considerando tanto o saldo já lançado no cartão quanto as parcelas futuras ainda não lançadas, sem duplicar compras ou pagamentos de fatura.

## Comportamento atual confirmado

- `Accounts.creditLimit` e `Accounts.refCreditLimit` representam o limite total configurado, respectivamente na moeda da conta e na moeda-base.
- O widget `credit-utilization-widget.vue` calcula a utilização a partir de `currentBalance`/ `refCurrentBalance` e do limite.
- `computeCreditUsed` trata contas manuais com saldo devedor e contas sincronizadas cujo saldo já incorpora o limite.
- `Transactions.isPlanned` já existe. Linhas planejadas não entram no saldo da conta; ao confirmar uma linha planejada, os hooks do modelo aplicam o efeito no saldo.
- O modelo de transações não possui campos tipados que identifiquem uma compra parcelada, seu grupo, sequência ou valor futuro. O campo JSON `externalData` não deve ser usado como substituto de uma relação financeira tipada.

## Regra contábil proposta

Uma compra parcelada é representada por uma sequência de lançamentos de parcela, e não por um lançamento integral adicional somado às parcelas.

1. Cada parcela tem seu próprio valor e vencimento.
2. Parcelas já lançadas como transações reais compõem o saldo atual do cartão.
3. Parcelas futuras permanecem como transações planejadas e não alteram o saldo atual.
4. A exposição utilizada do cartão é:

   `utilização = crédito já utilizado pelo saldo atual + reserva das parcelas futuras ainda planejadas`

5. Quando uma parcela planejada é confirmada pelo usuário ou conciliada com a transação importada do banco, ela deixa de compor a reserva e passa a compor o saldo real. A exposição total deve permanecer estável nessa transição.
6. O pagamento da fatura continua sendo transferência entre contas. Ele reduz o saldo devedor do cartão, mas não cria uma nova despesa nem altera o estado das parcelas futuras.

Essa regra evita contar a compra integral e, ao mesmo tempo, somar novamente as parcelas.

## Modelo de dados implementado na primeira etapa

As duas entidades relacionais foram criadas por migration transacional, com modelos Sequelize e registro no inventário de colunas monetárias/moeda. A migration está em `packages/backend/src/migrations/20261126120000-create-credit-card-installments.ts`.

Criadas sem guardar a fonte de verdade em JSON:

### `CreditCardInstallmentPlans`

- `id` UUID
- `userId` — proprietário do plano
- `accountId` — cartão de crédito
- `description`
- `purchaseDate`
- `currencyCode`
- `totalAmount` — valor total da compra na moeda do cartão
- `refTotalAmount` — valor total na moeda-base no momento da criação
- `installmentCount`
- `status` — ativo ou cancelado
- timestamps

### `CreditCardInstallments`

- `id` UUID
- `planId`
- `installmentNumber` — único por plano
- `dueDate`
- `amount` — valor na moeda do cartão
- `refAmount` — valor na moeda-base
- `transactionId` — transação correspondente, única quando preenchida
- `status` — planejada, lançada ou cancelada

Criar índices por `accountId/status/dueDate`, `planId/installmentNumber` e índice único parcial para `transactionId`. As FKs devem aplicar cascade na exclusão do plano e impedir órfãos. A migration deve ser transacional.

## Integração com o razão existente — estado atual

- Cada parcela deve possuir uma linha em `Transactions` vinculada à parcela.
- Parcelas ainda não lançadas usam `isPlanned = true`; parcelas já lançadas usam `isPlanned = false`.
- A criação do plano e de todas as linhas de transação/parcela deve ocorrer na mesma transação SQL.
- Ao confirmar uma parcela, atualizar a transação planejada existente — não criar uma segunda transação.
- Ao conciliar uma importação bancária, reutilizar o mecanismo de planned matching existente e manter a associação com a parcela.
- Impedir que uma linha planejada vinculada a parcela seja convertida em real por um caminho que não atualize a parcela correspondente.
- Usar valores monetários com a precisão/unidade já adotada pelo projeto; distribuir eventual resto de arredondamento na última parcela para que a soma seja exatamente igual ao total da compra.

## Cálculo de utilização — endpoint inicial

Para cada conta de cartão:

- manter a regra atual de `computeCreditUsed` para o saldo atual;
- somar somente `refAmount` das parcelas futuras cujo estado seja planejado e cuja transação vinculada continue com `isPlanned = true`;
- calcular o valor nativo da conta de forma equivalente, usando `amount`;
- expor valores nativos e de moeda-base para o widget; o widget consulta a exposição dos cartões próprios e soma a reserva ao crédito utilizado;
- nunca somar parcelas já lançadas, canceladas, excluídas ou sem vínculo válido;
- limitar a apresentação do percentual a 100%, mas preservar o valor monetário real mesmo se houver estouro do limite;
- respeitar conta ativa, exclusões de estatísticas e escopo de acesso/compartilhamento de contas.

O limite disponível será `max(limite total - utilização, 0)`. O valor de utilização não deve ser confundido com o ajuste patrimonial de `get-credit-limit-adjustment.ts`, que permanece responsável apenas pelos indicadores de patrimônio.

## Cancelamentos, estornos e pagamentos

- Cancelar uma compra cancela somente parcelas ainda planejadas; não apagar silenciosamente transações reais já lançadas.
- Estorno de parcela lançada deve usar o fluxo de reembolso existente e manter vínculo rastreável com a parcela/transação original.
- Uma parcela lançada deixa de ser reserva porque seu valor já está refletido no saldo do cartão, independentemente de a fatura ter sido paga.
- Pagamento parcial ou total da fatura deve continuar no fluxo de transferência já existente. Não marcar parcelas como pagas apenas porque houve pagamento da fatura: o pagamento liquida o saldo agregado, não identifica isoladamente quais compras foram pagas.

## Testes necessários antes de habilitar a funcionalidade

1. Criar compra parcelada e verificar que a soma das parcelas é exatamente o valor total.
2. Confirmar que somente parcelas futuras planejadas são somadas à reserva.
3. Confirmar uma parcela e verificar a troca de reserva por saldo real sem alteração da exposição total.
4. Conciliar uma parcela com importação bancária sem duplicar a transação.
5. Cancelar compra e liberar somente as parcelas futuras.
6. Estornar parcela lançada sem alterar indevidamente as demais parcelas.
7. Verificar moeda estrangeira, moeda-base e arredondamento.
8. Verificar conta excluída de estatísticas, conta arquivada e permissões de conta compartilhada.
9. Pagar fatura total/parcial e confirmar que o pagamento não vira despesa nem altera parcelas futuras.
10. Testar edição concorrente e idempotência da criação/concilição.

## Sequência de implementação — progresso

1. Implementar modelos, migration, índices e testes de persistência.
2. Implementar serviço transacional de criação/edição/cancelamento de plano e parcelas.
3. Integrar confirmação e planned matching com a parcela.
4. Implementar consulta agregada de reserva futura por cartão.
5. **Implementado parcialmente:** endpoint retorna exposição nativa e na moeda-base, filtrando parcelas com transação ainda planejada; widget soma reservas ao crédito utilizado.
6. **Implementado parcialmente:** painel de cadastro, listagem e cancelamento foi adicionado à aba Parcelamentos das contas manuais e às contas de cartão conectadas; traduções em inglês e pt-BR.
7. **Pendente:** executar E2E, lint e typecheck; revisar migration e fluxo de backup/restore antes de habilitar.

## Limites e pendências da implementação

A interface inicial ainda não permite editar planos nem associar manualmente uma parcela a uma transação já existente. A conciliação automática pelo planned matching está integrada. A migration ainda não foi executada em banco real e não há confirmação de CI, lint ou typecheck. O fluxo de estorno de parcelas lançadas e a cobertura completa de permissões/compartilhamento precisam ser validados antes de habilitar o recurso em produção.
