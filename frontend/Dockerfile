# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------------------------
# Étape 1 : build de l'application React (Node n'est utile qu'ici)
# ---------------------------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Les variables VITE_* sont remplacées par leur valeur DANS le JavaScript au moment du build :
# le navigateur ne lit pas de fichier .env. Changer d'URL d'API impose donc de rebuilder.
# Valeur par défaut : chemin relatif, Nginx relaie /api vers le backend (même origine).
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------------------------------------------------------------------------------------------
# Étape 2 : fichiers statiques servis par Nginx — ni Node, ni node_modules, ni code source
# Image « unprivileged » : Nginx tourne avec l'utilisateur nginx (uid 101), port 8080.
# ---------------------------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
