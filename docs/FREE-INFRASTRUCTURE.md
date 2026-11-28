# MONETRA — Infraestrutura gratuita

**Política obrigatória:** manter a implantação em serviços com plano gratuito, sem ativar faturamento, upgrades automáticos, créditos pagos ou cobrança por excedente. Se um limite gratuito for atingido, o serviço deve falhar de forma visível e a operação deve ser pausada; nunca migrar automaticamente para um plano pago.

## Arquitetura proposta

| Necessidade | Serviço gratuito proposto | Limite gratuito verificado em 27/11/2026 | Variável / integração |
|---|---|---|---|
| PostgreSQL | Neon Free | 1 GB por projeto, 100 CU-horas/mês, 5 GB de tráfego público por projeto; compute escala a zero após inatividade | `APPLICATION_DB_URL` pooled para tráfego da aplicação; `APPLICATION_DB_DIRECT_URL` direto para lock de migrações |
| Redis / BullMQ | Upstash Redis Free | 1 banco, 250 MB, 500 mil comandos/mês e 10 GB de banda/mês | `APPLICATION_REDIS_URL` (`rediss://`) |
| Anexos e arquivos | Neon Object Storage Free | 5 GB por projeto | `ATTACHMENTS_S3_BUCKET`, `ATTACHMENTS_S3_ENDPOINT`, `ATTACHMENTS_S3_ACCESS_KEY_ID`, `ATTACHMENTS_S3_SECRET_ACCESS_KEY`, `ATTACHMENTS_S3_REGION` |
| Aplicação | Vercel, no plano gratuito disponível à conta | Sujeito aos limites e recursos habilitados no plano da conta | Projeto Vercel MONETRA já conectado ao GitHub |

Fontes oficiais consultadas:
- Neon: https://neon.com/docs/introduction/plans e https://neon.com/docs/introduction/free-tier
- Upstash: https://upstash.com/pricing/redis
- Neon Object Storage: https://neon.com/docs/storage/overview e https://neon.com/docs/introduction/plans

## Limites e comportamento

- **Neon:** o limite de compute e tráfego é mensal. Ao esgotar a franquia gratuita, o projeto pode suspender conexões até a renovação; não habilitar upgrade automático.
- **Upstash:** ao atingir limites gratuitos, comandos podem ser limitados/rejeitados. Não converter a conta para Pay-as-you-go.
- **Neon Object Storage:** o limite gratuito é de 5 GB por projeto, compartilhado entre branches. Buckets privados são usados para anexos; credenciais devem ter somente `storage:read` e `storage:write`.
- **Vercel:** confirmar no painel da conta que Containers/Services/Daemons usados pelo projeto estão incluídos no plano disponível. Se não estiverem, não ativar upgrade: adaptar a arquitetura antes de publicar.
- As franquias são limites de uso, não garantia de SLA, alta disponibilidade ou backup. Antes de guardar dados financeiros reais, configurar exportação/backup periódico e testar restauração em destino separado, também gratuito.
- Não colocar credenciais em commits, arquivos `.env`, frontend ou logs. Guardar apenas em variáveis de ambiente server-side.

## Bloqueios que ainda exigem configuração

1. **Concluído em 27/11/2026:** projeto `monetra` criado na organização Neon Free `Geovanna`, região `aws-us-east-2`, PostgreSQL 17, branch `main`, compute mínimo 0,25 CU e banco `monetra`. O banco está vazio (nenhuma tabela/migração aplicada).
2. **Concluído em 27/11/2026:** branch Neon `preview` criada como clone isolado da branch `main`; o banco de Preview está separado.
3. **Concluído em 27/11/2026:** bucket privado `monetra-attachments` criado na branch principal e herdado pela branch `preview`; credencial com escopos `storage:read` e `storage:write` emitida.
4. **Concluído em 27/11/2026:** variáveis criptografadas de PostgreSQL e Object Storage cadastradas no Vercel somente para Preview da branch `infra/production-readiness`.
5. **Concluído temporariamente em 27/11/2026:** Upstash Redis Free sem cadastro foi provisionado para Preview; `APPLICATION_REDIS_URL` está criptografada no Vercel. A base expira em 30/11/2026 se não for reivindicada pelo proprietário no console da Upstash.
6. Validar migrações, filas, anexos, autenticação e health checks. O banco Redis só pode ser usado para testes até ser reivindicado.
7. Só então configurar Production e publicar. Confirmar que nenhum serviço exige cartão, upgrade, plano pago ou faturamento por excedente. Se exigir, interromper e escolher outra opção gratuita.

## Estado real em 27/11/2026

- O último deploy Preview da branch `infra/production-readiness` concluiu o build com status `READY`.
- O build pronto não comprova conexão com PostgreSQL, Redis, armazenamento, autenticação nem fluxos financeiros.
- `APPLICATION_DB_URL` aponta para a branch Neon isolada `preview` usando o pooler; `APPLICATION_DB_DIRECT_URL` aponta para o mesmo banco sem pooler, exclusivamente para o advisory lock de sessão que serializa migrações. Ambas estão cadastradas como variáveis secretas somente no Preview. Nenhuma variável de banco foi adicionada a Production.
- Bucket privado `monetra-attachments` e credencial de escopo mínimo criados no Neon Object Storage; variáveis S3 compatíveis também estão cadastradas somente no Preview. O cliente AWS SDK foi ajustado para path-style addressing, obrigatório no Neon.
- Redis Upstash Free temporário foi provisionado e ligado somente ao Preview; precisa ser reivindicado até 30/11/2026 para não expirar. Nenhuma migração foi aplicada e nenhum teste ponta a ponta foi executado.
- A publicação em Production permanece bloqueada até a validação ponta a ponta.
