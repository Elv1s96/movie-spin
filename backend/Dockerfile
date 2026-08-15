# Бекенд Spin API — збірка + рантайм (Node 22). Міграції БД накочуються на старті.

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# openssl потрібен уже тут: Prisma за ним визначає таргет рушія при generate,
# інакше згенерований engine не збіжиться з рантаймом.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# openssl потрібен рушію Prisma
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
# node_modules із build-стейджу: містять @prisma/client зі згенерованим рушієм
# і CLI `prisma` для `migrate deploy` на старті.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p uploads
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
