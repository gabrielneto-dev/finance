FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
