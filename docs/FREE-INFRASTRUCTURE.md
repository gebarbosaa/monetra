# MONETRA — Infraestrutura gratuita

**Política obrigatória:** manter a implantação em serviços com plano gratuito, sem ativar faturamento, upgrades automáticos, créditos pagos ou cobrança por excedente. Se um limite gratuito for atingido, o serviço deve falhar de forma visível e a operação deve ser pausada; nunca migrar automaticamente para um plano pago.

## Arquitetura proposta

| Necessidade | Serviço gratuito proposto | Limite gratuito verificado em 27/11/2026 | Variável / integração |
|---|---|---|---|
| PostgreSQL | Neon Free | 1 GB por projeto, 100 CU-horas/mês, 5 GB de tráfego público por projeto; compute escala a zero após inatividade | `APPLICATION_DB_URL` com `sslmode=require` |
| Redis / BullMQ | Upstash Redis Free | 1 banco, 250 MB, 500 mil comandos/mês e 10 GB de banda/mês | `APPLICATION_REDIS_URL` (`rediss://`) |
| Anexos e arquivos | Cloudflare R2 Standard Free allowance | 10 GB-mês, 1 milhão de operações Classe A e 10 milhões Classe B por mês; egress gratuito | Adaptador S3 já suportado pelo backend; conferir os nomes exatos das variáveis no código antes de configurar |
| Aplicação | Vercel, no plano gratuito disponível à conta | Sujeito aos limites e recursos habilitados no plano da conta | Projeto Vercel MONETRA já conectado ao GitHub |

Fontes oficiais consultadas:
- Neon: https://neon.com/docs/introduction/plans e https://neon.com/docs/introduction/free-tier
- Upstash: https://upstash.com/pricing/redis
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/

## Limites e comportamento

- **Neon:** o limite de compute e tráfego é mensal. Ao esgotar a franquia gratuita, o projeto pode suspender conexões até a renovação; não habilitar upgrade automático.
- **Upstash:** ao atingir limites gratuitos, comandos podem ser limitados/rejeitados. Não converter a conta para Pay-as-you-go.
- **R2:** usar apenas armazenamento Standard dentro da franquia gratuita. Não habilitar Infrequent Access nem qualquer configuração paga.
- **Vercel:** confirmar no painel da conta que Containers/Services/Daemons usados pelo projeto estão incluídos no plano disponível. Se não estiverem, não ativar upgrade: adaptar a arquitetura antes de publicar.
- As franquias são limites de uso, não garantia de SLA, alta disponibilidade ou backup. Antes de guardar dados financeiros reais, configurar exportação/backup periódico e testar restauração em destino separado, também gratuito.
- Não colocar credenciais em commits, arquivos `.env`, frontend ou logs. Guardar apenas em variáveis de ambiente server-side.

## Bloqueios que ainda exigem configuração

1. **Concluído em 27/11/2026:** projeto `monetra` criado na organização Neon Free `Geovanna`, região `aws-us-east-2`, PostgreSQL 17, branch `main`, compute mínimo 0,25 CU e banco `monetra`. O banco está vazio (nenhuma tabela/migração aplicada).
2. Criar um banco Redis exclusivo no Upstash Free.
3. Criar um bucket privado no Cloudflare R2 Standard e gerar credenciais S3 com acesso mínimo ao bucket.
4. Cadastrar os valores em Preview primeiro; validar migrações, filas, anexos, autenticação e health checks.
5. Só então replicar as variáveis em Production e publicar o domínio principal.
6. Confirmar que nenhum serviço exige cartão, upgrade, plano pago ou faturamento por excedente. Se exigir, interromper e escolher outra opção gratuita.

## Estado real em 27/11/2026

- O último deploy Preview da branch `infra/production-readiness` concluiu o build com status `READY`.
- O build pronto não comprova conexão com PostgreSQL, Redis, armazenamento, autenticação nem fluxos financeiros.
- `APPLICATION_DB_URL` foi cadastrada como variável criptografada no Vercel, restrita ao Preview da branch `infra/production-readiness`. Nenhuma variável de banco foi adicionada a Production. A conexão ainda precisa ser validada pela aplicação após uma build de código.
- Redis Upstash e bucket R2 ainda não foram provisionados; sem Redis, a inicialização atual do backend não está pronta para smoke test. Nenhuma migração foi aplicada e nenhum teste de ponta a ponta foi executado.
- A publicação em Production permanece bloqueada até a validação ponta a ponta.
