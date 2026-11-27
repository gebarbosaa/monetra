# MONETRA — guia de instalação em servidor

> Para implantação do MONETRA, use o guia mantido no próprio repositório:
> [docs/MONETRA-VPS-DEPLOYMENT.md](../../docs/MONETRA-VPS-DEPLOYMENT.md).

Este documento substitui o quickstart upstream que acompanhava a base MoneyMatter. Não clone `letehaha/moneymatter` e não use imagens publicadas pelo upstream para instalar o MONETRA.

## Build correto a partir do código MONETRA

Na raiz do clone `gebarbosaa/monetra`:

```bash
cp self-hosting/.env.example self-hosting/.env
# Edite self-hosting/.env com URLs públicas e segredos fortes.
cd self-hosting
docker compose -f docker-compose.yml -f docker-compose.build.yml config
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

O overlay compila frontend e backend do checkout atual. PostgreSQL, Redis e anexos usam volumes Docker. Não exponha as portas internas de banco, Redis ou backend à internet.

## Avisos

- Nunca comite `self-hosting/.env`.
- Faça e teste backup do PostgreSQL e do volume de anexos antes de usar dados reais.
- Configure HTTPS e valide autenticação/cookies no domínio final.
- Uma build bem-sucedida não comprova que o backend, migrations, filas ou operações financeiras estejam validados.
