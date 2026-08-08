# Image de production.
#
# ⚠️ **Le serveur tourne sous Node, pas sous Bun** : Bun 1.3 ne charge pas le
# driver MongoDB (`bson` appelle `node:v8 isBuildingSnapshot`, non implémenté).
# Bun reste l'outil de build — il empaquette pour Node. Voir la déviation D-13
# du suivi d'implémentation.
#
# Construction multi-architecture : le développement est x86 (Mac/Windows), la
# production est ARM (Raspberry Pi). Sans `--platform`, l'image produite ne
# démarrerait pas sur le Pi — c'est le point P2-8 de la revue critique.

FROM oven/bun:1 AS build
WORKDIR /app

# Les manifestes d'abord : la couche d'installation se réutilise tant que les
# dépendances ne bougent pas.
COPY package.json bun.lock tsconfig*.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/domain/package.json packages/domain/
COPY packages/persistence/package.json packages/persistence/
COPY packages/printing/package.json packages/printing/
COPY packages/api/package.json packages/api/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Image finale : Node seul, sans outillage de build ---
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV CHAMPI_WEB_ROOT=/app/web

# Seuls les artefacts empaquetés : ni node_modules, ni sources.
COPY --from=build /app/packages/api/dist/server.mjs ./server.mjs
COPY --from=build /app/packages/cli/dist/champi.mjs ./champi.mjs
COPY --from=build /app/apps/web/dist ./web

# L'application ne tourne pas en root : une compromission ne doit pas donner
# la main sur l'hôte.
USER node

EXPOSE 3000

# Le contrôle de santé interroge l'application, pas le processus : un serveur
# vivant mais incapable de joindre MongoDB doit être signalé.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
