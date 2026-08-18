FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json tsconfig.json ./
# instala tudo (inclusive dev) para poder compilar o TypeScript
RUN npm install --no-audit --no-fund

COPY src ./src
RUN npx tsc && npm prune --omit=dev && npm cache clean --force

RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "dist/server.js"]
