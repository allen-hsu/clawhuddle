FROM node:22-alpine
RUN apk add --no-cache git
RUN npm install -g openclaw@latest
RUN adduser -D -h /home/openclaw openclaw
USER openclaw
WORKDIR /home/openclaw
ENTRYPOINT ["openclaw", "gateway"]
