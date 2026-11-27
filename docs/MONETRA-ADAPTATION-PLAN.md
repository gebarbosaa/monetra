# MONETRA — Plano de adaptação

## 1. Produto e experiência

- Nome: MONETRA.
- Assinatura: Family Finance OS.
- Idioma padrão: Português (Brasil).
- Moeda principal: BRL (R$).
- Visual: premium, minimalista e responsivo; base clara, grafite e laranja.
- Uso: gestão privada da economia familiar, sem integração bancária.

## 2. Modelo familiar

A família é uma única unidade econômica consolidada, com caixa comum e visão financeira única.

- Não criar rateio automático 50/50.
- Não criar saldos, carteiras, dívidas ou patrimônio separados por membro.
- Não criar fluxo de reembolso ou dívida entre membros como comportamento padrão.
- Campo de pessoa responsável serve somente para rastreabilidade e auditoria.
- Categorias e relatórios devem consolidar toda a família.

## 3. Pessoas, residência e animais

- Pessoas registradas para rastreabilidade: Camila e Rafael.
- Contexto residencial: residência compartilhada.
- Animais: Luna (gata) e Thor (cachorro).
- Animais não são unidades financeiras nem devem gerar módulo ou aba financeira própria.
- Despesas veterinárias e de cuidados entram na categoria comum **Pets**.
- Campo opcional de animal: Luna, Thor ou Ambos.
- Reserva veterinária pode ser uma meta/reserva dentro dos objetivos financeiros gerais.

## 4. Módulos financeiros necessários

1. Visão geral consolidada e fluxo de caixa.
2. Contas e saldos.
3. Receitas, despesas e transferências.
4. Cartões de crédito, compras, parcelas e faturas.
5. Orçamentos por categoria e período.
6. Despesas recorrentes e contas a pagar.
7. Dívidas, juros, amortização e cronogramas.
8. Metas, reservas e provisões.
9. Investimentos, ativos e patrimônio líquido.
10. Projeções e planejamento.
11. Relatórios mensais e anuais.
12. Histórico, trilha de auditoria e exportação.

## 5. Regras de integridade financeira

- Compra no cartão reconhece a despesa uma única vez.
- Pagamento da fatura é liquidação/transferência, não uma segunda despesa.
- Transferências internas não entram como receita nem despesa.
- O saldo disponível do cartão deve considerar compromissos futuros ainda em aberto, sem duplicar parcelas já liquidadas.
- Parcelamentos e dívidas precisam de cronogramas consistentes e idempotentes.
- Principal de empréstimos/passivos deve ser distinguido de renda comum.
- Se existir categoria ou marcador **GRANA EXTRA**, excluí-lo do ranking Top 15 de despesas conforme a regra de negócio definida.
- Alterações relevantes devem deixar registro de auditoria.
- Geração de recorrências deve impedir duplicação, inclusive em reprocessamentos.

## 6. Integrações e privacidade

- Não implementar conexão com bancos, open banking ou sincronização bancária automática.
- Manter entrada manual.
- Avaliar importação de arquivos somente se não exigir conexão bancária.
- Proteger dados financeiros com autenticação, autorização por usuário e validação no backend.
- Segredos e chaves nunca devem ser expostos no frontend.

## 7. Diretrizes técnicas e implantação

A base upstream usa Vue 3/Vite/TypeScript/Tailwind, Node/Express, Sequelize, PostgreSQL e Redis/BullMQ.

A arquitetura gratuita selecionada está documentada em [FREE-INFRASTRUCTURE.md](FREE-INFRASTRUCTURE.md):
- PostgreSQL: Neon Free.
- Redis/BullMQ: Upstash Redis Free.
- Arquivos: Cloudflare R2 Standard dentro da franquia gratuita.
- Aplicação: Vercel, somente se os recursos necessários estiverem disponíveis no plano gratuito da conta.

**Não ativar faturamento, upgrades automáticos ou planos pagos.** Se qualquer componente exigir pagamento ou ultrapassar a franquia gratuita, interromper e reavaliar antes de prosseguir.

Antes de qualquer implantação:
- Confirmar versões e scripts de build/teste.
- Mapear todos os serviços persistentes e workers.
- Criar e configurar serviços exclusivos para MONETRA.
- Configurar variáveis de ambiente e segredos no servidor.
- Validar migrações, backups e restauração.
- Separar frontend, API e workers conforme as limitações reais da plataforma de hospedagem.
- Não considerar Docker Compose diretamente executável na Vercel sem adaptação.

## 8. Etapas de execução

### Etapa A — Identidade e idioma
- [x] Marca MONETRA nos metadados HTML.
- [x] Manifesto PWA com nome e cores MONETRA.
- [x] Favicon SVG inicial MONETRA.
- [x] Português do Brasil como locale padrão no pacote compartilhado.
- [x] Documentação inicial do produto.
- [ ] Atualizar identidade visual em todos os componentes e landing page.
- [ ] Substituir os ícones PNG antigos por versões MONETRA.

### Etapa B — Auditoria da arquitetura
- [ ] Mapear autenticação, usuários, permissões e modelo multiusuário.
- [ ] Identificar e desativar fluxos de sincronização bancária sem quebrar importações manuais.
- [ ] Revisar moeda base, casas decimais, arredondamento e datas.
- [ ] Mapear jobs, filas, cache, anexos e dependências de infraestrutura.

### Etapa C — Modelo financeiro familiar
- [ ] Definir a família como unidade consolidada.
- [ ] Implementar regras de transferências, cartões e faturas sem duplicidade.
- [ ] Validar parcelamentos, dívidas, limites e projeções.
- [ ] Implementar metas e relatórios familiares.

### Etapa D — Qualidade e segurança
- [ ] Testes unitários e de integração das regras financeiras.
- [ ] Testes de regressão para faturas, parcelas e transferências.
- [ ] Revisão de autorização, isolamento de dados e auditoria.
- [ ] Build de produção e verificação de acessibilidade/responsividade.

### Etapa E — Infraestrutura e publicação
- [x] Definir arquitetura-alvo com provedores e franquias gratuitas.
- [ ] Criar/configurar banco PostgreSQL, Redis e armazenamento de arquivos.
- [ ] Configurar ambientes de desenvolvimento, preview e produção.
- [ ] Executar migrações e validar backups/restauração.
- [ ] Validar cadastro, login, operações financeiras, filas e anexos em Preview.
- [ ] Publicar somente após testes de ponta a ponta.

## 9. Critério de conclusão

Uma etapa só pode ser marcada como concluída quando a alteração estiver no código, os testes aplicáveis tiverem sido executados e o resultado estiver registrado. Itens planejados não devem ser apresentados como funcionalidades já disponíveis.
