# MONETRA — Family Finance OS

**Gestão financeira familiar, consolidada em um só lugar.**

MONETRA é a adaptação do projeto open-source MoneyMatter para uma experiência de gestão financeira familiar em português do Brasil. O objetivo é reunir contas, receitas, despesas, cartões, compromissos, metas e patrimônio em uma visão única da economia da família.

> **Estado do produto:** esta base ainda está em adaptação. As funcionalidades descritas no plano não devem ser consideradas entregues até serem implementadas e validadas no código.

## Direção do produto

- **Idioma e formato:** português do Brasil, moeda principal BRL (R$).
- **Modelo financeiro:** uma única unidade econômica familiar consolidada; não há divisão automática de saldos entre membros.
- **Lançamentos:** registros manuais, sem integração bancária ou sincronização automática com bancos.
- **Rastreabilidade:** pessoa responsável é apenas informação de auditoria, não representa saldo ou dívida individual.
- **Experiência:** interface minimalista e responsiva, com fundo claro, grafite e acentos em laranja.
- **Hospedagem pretendida:** Vercel para os componentes compatíveis, com serviços externos para banco de dados, cache, filas e arquivos quando necessários.

## Escopo funcional planejado

- Contas, saldos, receitas, despesas e transferências internas.
- Cartões, compras, parcelas, faturas e liquidação de faturas.
- Orçamentos, despesas recorrentes, contas a pagar e alertas.
- Dívidas, juros, amortização e projeções.
- Metas, reservas, investimentos, ativos e patrimônio líquido.
- Fluxo de caixa, relatórios mensais e anuais, histórico e auditoria.

### Regras financeiras essenciais

1. A compra no cartão é registrada como despesa.
2. O pagamento da fatura liquida o passivo e deve ser tratado como transferência/liquidação, sem duplicar a despesa.
3. Transferências entre contas da família não são receitas nem despesas.
4. Parcelas e cronogramas de dívidas não podem duplicar compromissos já reconhecidos.
5. O orçamento e os relatórios representam a família como uma única unidade financeira.

## Desenvolvimento

O projeto herdou a arquitetura do MoneyMatter: Vue 3, Vite, TypeScript e Tailwind no frontend; Node.js, Express, Sequelize, PostgreSQL e Redis/BullMQ no backend. A estrutura atual usa workspaces npm.

A hospedagem completa não é um deploy estático simples: o backend e os workers dependem de serviços persistentes. Antes de publicar, será necessário definir e configurar PostgreSQL, Redis/filas e armazenamento de arquivos em serviços compatíveis. Não presuma que Docker Compose ou todos os processos de longa duração serão executados diretamente na Vercel.

## Plano de adaptação

Consulte [docs/MONETRA-ADAPTATION-PLAN.md](docs/MONETRA-ADAPTATION-PLAN.md) para requisitos, regras de negócio, etapas e pendências técnicas.

## Créditos e licença

MONETRA é derivado de [MoneyMatter](https://github.com/letehaha/moneymatter), criado por **letehaha**. A arquitetura, partes do código e componentes do projeto original permanecem sujeitos aos avisos de direitos autorais e à licença **GNU Affero General Public License v3.0 (AGPL-3.0)**. Este repositório mantém a licença upstream; modificações distribuídas ou disponibilizadas como serviço de rede devem cumprir as obrigações da AGPL-3.0.

Consulte o arquivo [LICENSE](LICENSE) e os avisos de copyright do projeto original. Esta adaptação não reivindica autoria sobre o código upstream.
