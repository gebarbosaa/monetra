> **Optional self-hosting alternative only.** The selected MONETRA deployment plan is Vercel. Do not purchase or provision a VPS for the current plan.

> **Optional alternative only:** MONETRA's current target deployment is
> Vercel. The Docker Compose setup below is for users who explicitly choose
> self-hosting; it is not required for the planned Vercel deployment.
>
# MONETRA — Self-hosting

Este diretório contém a implantação Docker do MONETRA. Para produção, construa as imagens a partir **deste repositório**; não use imagens pré-compiladas do upstream MoneyMatter.

## Guia recomendado para VPS

Consulte [MONETRA VPS deployment](../docs/MONETRA-VPS-DEPLOYMENT.md) antes de executar qualquer comando em um servidor.

## Build local / VPS a partir do código

Na raiz do repositório:

```bash
cp self-hosting/.env.example self-hosting/.env
# Edite self-hosting/.env e substitua TODOS os segredos de exemplo.
cd self-hosting
docker compose -f docker-compose.yml -f docker-compose.build.yml config
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

O compose mantém PostgreSQL, Redis, backend e armazenamento de anexos na rede/volumes Docker. Somente o frontend publica a porta HTTP. Configure HTTPS por meio de um proxy reverso (Caddy, Traefik ou Nginx Proxy Manager).

**Não** execute o compose base sozinho para produção: ele é um template pull-based herdado e não representa uma publicação validada das imagens MONETRA.

## Arquivos

- `docker-compose.yml`: serviços, rede interna e volumes persistentes.
- `docker-compose.build.yml`: build local das imagens frontend/backend.
- `.env.example`: modelo sem credenciais reais.
- `backend/` e `frontend/`: Dockerfiles e entrypoints.

Nunca envie `.env`, senhas, chaves JWT ou credenciais de provedores ao GitHub.
