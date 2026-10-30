# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------------------------
# Étape 1 : dépendances de production
# Image complète séparée : si une dépendance native devait être compilée, les outils de
# compilation resteraient ici et ne seraient jamais copiés dans l'image finale.
# ---------------------------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

# On copie d'abord uniquement les manifestes : tant qu'ils ne changent pas, Docker réutilise
# la couche `npm ci` en cache, même si le code source change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------------------------
# Étape 2 : image d'exécution, la plus petite possible
# ---------------------------------------------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts ./scripts

# Utilisateur non-root fourni par l'image Node : si l'API était compromise, l'attaquant
# n'aurait pas les droits administrateur dans le conteneur.
USER node

EXPOSE 3000

# Docker interroge /health : le conteneur passe « healthy » quand l'API répond ET joint la base.
# ${PORT:-3000} : l'hébergeur (Render) peut imposer un autre port via la variable PORT.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/v1/health" > /dev/null || exit 1

CMD ["sh", "scripts/docker-entrypoint.sh"]
