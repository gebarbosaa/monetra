> **Optional self-hosting alternative only.** The selected MONETRA deployment plan is Vercel. Do not purchase or provision a VPS for the current plan.

> **Architecture decision (2026-11-27):** MONETRA's selected target is Vercel.
> This VPS guide is retained only as an optional self-hosting fallback. Do not
> purchase or provision a VPS as part of the current deployment plan.
>
# MONETRA — plano de implantação em VPS

## Decisão de arquitetura

- **Frontend:** Vercel, build estático Vite já configurado.
- **Backend:** VPS Linux com Docker Compose.
- **Dados:** PostgreSQL 16 em volume persistente privado.
- **Filas e jobs:** Redis 7 privado na rede Docker.
- **Arquivos:** volume persistente de anexos; migrar para storage S3 compatível quando houver necessidade de alta disponibilidade.
- **TLS/domínio:** proxy reverso (Caddy, Traefik ou Nginx Proxy Manager) com HTTPS.
- **Sidecar de câmbio:** serviço separado no Compose.

Não rodar o backend como uma Vercel Function: o projeto utiliza processos persistentes, filas, workers, cron jobs, conexões Redis e armazenamento local.

## Dimensionamento inicial econômico

Para uma instalação pessoal/familiar pequena, use como ponto de partida:
- Ubuntu Server 24.04 LTS ou Debian 12;
- 2 vCPU;
- 4 GB RAM (2 GB é apenas um mínimo apertado, especialmente durante build);
- 40 GB SSD/NVMe;
- snapshots/backup externo habilitados.

O build das imagens pode consumir memória considerável. Se a VPS tiver pouca RAM, faça o build em máquina/CI com Docker Buildx e envie imagens privadas para um registry, ou aumente temporariamente a memória durante o build. Não reduza limites de memória sem validar.

A escolha do fornecedor e o preço dependem de região, tráfego, armazenamento e política de backup; este documento não contrata nem provisiona um servidor.

## Antes de provisionar

1. Contrate uma VPS com acesso administrativo e console de recuperação.
2. Registre um domínio ou subdomínio para o app.
3. Aponte o DNS para o IP público da VPS.
4. Libere somente SSH (preferencialmente restrito ao seu IP), HTTP e HTTPS no firewall.
5. Não exponha as portas PostgreSQL 5432, Redis 6379 ou backend 8081 à internet.
6. Use chave SSH, atualizações de segurança e autenticação forte no painel do provedor.

## Preparar o servidor

Instale Docker Engine e o plugin Docker Compose seguindo a documentação oficial da distribuição. Depois:

```bash
git clone https://github.com/gebarbosaa/monetra.git
cd monetra
git checkout dev
cp self-hosting/.env.example self-hosting/.env
```

Edite `self-hosting/.env` no próprio servidor. Gere **quatro valores independentes** (três segredos da aplicação e a senha do banco), por exemplo:

```bash
openssl rand -base64 48
```

Não reutilize o mesmo valor. Preencha:
- `APPLICATION_JWT_SECRET`
- `APP_SESSION_ID_SECRET`
- `BETTER_AUTH_SECRET`
- `APPLICATION_DB_PASSWORD`

Defina também `BETTER_AUTH_URL` e `AUTH_ORIGIN` com a URL pública HTTPS exata que será usada no navegador. Configure `ALLOWED_ORIGINS` para a origem do frontend quando ele estiver em domínio separado. O frontend servido pelo próprio stack pode usar same-origin e proxy interno.

## Build e inicialização

Execute a partir de `self-hosting/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml config
docker compose -f docker-compose.yml -f docker-compose.build.yml build
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d
docker compose ps
docker compose logs --tail=200 backend
```

O overlay de build compila o backend e frontend a partir do checkout MONETRA. Não use o compose base isoladamente para uma publicação MONETRA, pois ele foi herdado com referências pull-based upstream. A imagem do sidecar de câmbio continua sendo um serviço de terceiros separado.

O entrypoint do backend executa migrations conforme a implementação atual. Antes de apontar dados reais, confirme no log que as migrations terminaram e que o healthcheck está saudável.

## Topologia Vercel + VPS

A implantação atual da Vercel é apenas frontend estático. Para conectar:
1. Defina `VITE_APP_API_HTTP` na Vercel como a origem HTTPS pública da API, se o backend for servido em domínio separado.
2. Defina `VITE_APP_API_VER=/api/v1`.
3. Configure o proxy reverso para encaminhar a API ao backend interno.
4. Configure no backend `BETTER_AUTH_URL`, `AUTH_ORIGIN` e `ALLOWED_ORIGINS` coerentes com o domínio real do frontend e com o fluxo de autenticação.
5. Teste cookies, SameSite/Secure, CORS, login, logout e chamadas autenticadas em navegador real. Se a autenticação exigir cookies cross-site, valide explicitamente o comportamento nos navegadores alvo; não presuma que CORS sozinho resolve.
6. Mantenha todos os segredos somente no ambiente do servidor. Nunca use prefixo `VITE_` para segredos.

**Atenção:** o domínio Vercel e a API em domínio separado podem exigir configuração adicional de cookies e CORS. A opção mais simples para autenticação costuma ser servir frontend e API sob a mesma origem por meio de um proxy reverso. A Vercel estática, por si só, não cria esse proxy para uma VPS.

## Backup e recuperação — obrigatório antes de produção

- Faça backup consistente do PostgreSQL com `pg_dump` e teste a restauração em banco separado.
- Faça backup do volume de anexos junto com os metadados correspondentes.
- Redis contém filas/cache; não o trate como substituto do backup do banco.
- Armazene cópias criptografadas fora da VPS e teste a recuperação periodicamente.
- Documente RPO/RTO e retenção antes de usar dados financeiros reais.

## Portões de liberação

Não considerar o MONETRA pronto para produção até:
- migrations concluídas e restore de backup testado;
- healthchecks de backend, PostgreSQL, Redis e sidecar saudáveis;
- anexos persistentes após recriação de containers;
- autenticação e cookies validados por HTTPS;
- testes de leitura/escrita financeira, parcelamentos, faturas, estornos e recorrências;
- lint, typecheck, testes unitários e E2E executados com resultados registrados;
- vulnerabilidades do `npm audit` triadas;
- domínio, monitoramento e procedimento de rollback definidos.

## Segurança operacional

Não compartilhe senhas, chaves privadas, tokens SSH ou arquivos `.env` nesta conversa. Para a configuração final, use o painel seguro do provedor e variáveis locais no servidor. Este guia prepara o procedimento, mas não significa que uma VPS já foi contratada, provisionada ou que o backend já esteja no ar.
