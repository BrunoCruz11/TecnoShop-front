# nginx que corre sin root (usuario nginx, puerto 8080)
FROM nginxinc/nginx-unprivileged:1.27-alpine

# direccion interna del back y URL que usa el navegador para llegar a la API
ENV API_UPSTREAM=http://backend:8080 \
    API_URL=/api

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY img /usr/share/nginx/html/img

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
