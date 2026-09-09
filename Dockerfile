FROM node:20-alpine AS deps
WORKDIR /app
# A imagem "-alpine" não inclui OpenSSL — só a cópia estática que o próprio Node usa
# internamente, que não fica disponível para outros binários linkarem em runtime. O
# query engine do Prisma é um binário Rust separado que faz dynamic linking contra a
# libssl do sistema; sem este pacote, ele nem consegue detectar a versão instalada
# (gera o aviso "Prisma failed to detect the libssl/openssl version") e falha ao
# carregar com "Error loading shared library libssl.so.1.1: No such file or directory".
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm run build:workers

FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
CMD ["node", "server.js"]

FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
CMD ["node", "dist/wa-gateway/index.js"]
