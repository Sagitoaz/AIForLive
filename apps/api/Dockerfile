FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages
COPY prisma prisma
RUN npm ci
COPY tsconfig.base.json eslint.config.mjs ./
COPY apps/api apps/api
RUN npm run build --workspace @edurecall/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY domains ./domains
EXPOSE 4000
CMD ["node", "dist/main.js"]
