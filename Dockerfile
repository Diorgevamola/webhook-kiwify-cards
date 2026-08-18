FROM node:22-alpine
WORKDIR /app

# ATENÇÃO: NODE_ENV=production faz o npm PULAR as devDependencies — e o
# TypeScript vive nelas. Por isso o build acontece antes, e só depois a
# variável é definida, já na etapa de execução.
COPY package.json package-lock.json tsconfig.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY src ./src
RUN ./node_modules/.bin/tsc \
 && test -f dist/server.js \
 && npm prune --omit=dev \
 && npm cache clean --force

ENV NODE_ENV=production
ENV PORT=3000
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "dist/server.js"]
