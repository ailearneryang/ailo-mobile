FROM node:24-alpine
WORKDIR /app
COPY relay/server.cjs ./server.cjs
ENV HOST=0.0.0.0 PORT=8787 AILO_RELAY_DATA=/data
EXPOSE 8787
CMD ["node", "server.cjs"]
