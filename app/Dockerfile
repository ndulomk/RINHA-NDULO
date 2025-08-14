FROM node:20-alpine

WORKDIR /app

# Instala dependências de build
RUN apk add --no-cache python3 make g++ postgresql-client

# Cache de dependências
COPY package*.json ./
RUN npm ci --only=production

# Copia o código fonte
COPY src ./src
COPY sql ./sql
COPY config.js ./config.js

# Configurações de saúde e monitoramento
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9999/health || exit 1

# Otimizações para produção
ENV NODE_ENV=production \
    PORT=9999 \
    WORKERS=8 \
    QUEUE_SIZE=2000

# Limpeza para reduzir tamanho da imagem
RUN apk del python3 make g++ && \
    rm -rf /var/cache/apk/*

USER node

EXPOSE 9999

CMD ["node", "--max-old-space-size=256", "src/server.js"]