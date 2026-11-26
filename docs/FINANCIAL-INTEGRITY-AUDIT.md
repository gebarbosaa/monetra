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

### 3. Seleção de animais nas transações

O utilitário de seleção de tags foi endurecido para aceitar como animal somente IDs com marcador `MONETRA_PET:`. Tags comuns e IDs inexistentes não são mais anexados como seleção de animal. Foram adicionados casos de regressão em `pet-tag-selection.spec.ts`.

## Pontos que continuam em aberto

1. Criar ou localizar teste de regressão que registre uma compra no cartão e depois liquide a fatura sem duplicar a despesa nos relatórios.
2. Auditar o cálculo do limite disponível do cartão com parcelas futuras, parcelas pagas, estornos e compras canceladas.
3. Validar transferências internas para garantir que não sejam somadas como receita ou despesa nos relatórios familiares.
4. Verificar a exclusão de `GRANA EXTRA` no ranking Top 15, sem ocultar os lançamentos do razão financeiro.
5. Revisar idempotência de lançamentos recorrentes e trilha de auditoria das alterações relevantes.
6. Confirmar que relatórios, saldos e categorias usam a unidade familiar consolidada, sem rateio automático por pessoa.

## Estado de validação

- Alteração do seletor de animais: gravada na branch `dev`, com teste de regressão adicionado.
- Testes automatizados: **não executados nesta sessão**; o acesso disponível ao repositório permite leitura e gravação no GitHub, mas não disponibiliza um runner local para executar Jest.
- GitHub Actions: a consulta de execuções da branch `dev` não retornou execuções.
- Deploy: não iniciado.

## Próxima ação recomendada

Continuar a auditoria de cartões e faturas no backend, localizar o fluxo real de liquidação e só então implementar um teste de regressão para o cenário de dupla contabilização. Não alterar regras financeiras sem confirmar o comportamento atual e os modelos envolvidos.
