FROM nginx:1.25-alpine

# Remove configurações padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copia configuração customizada
COPY nginx.conf /etc/nginx/nginx.conf

# Otimizações de segurança
RUN apk add --no-cache openssl && \
    mkdir -p /var/cache/nginx && \
    chown -R nginx:nginx /var/cache/nginx && \
    chmod -R 755 /var/cache/nginx

USER nginx

EXPOSE 9999

STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]