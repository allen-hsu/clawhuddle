FROM node:22-alpine
RUN apk add --no-cache git cmake make g++ python3
RUN npm install -g openclaw@latest
RUN apk del cmake make g++ python3
RUN adduser -D -h /home/openclaw openclaw
USER openclaw
WORKDIR /home/openclaw
ENTRYPOINT ["openclaw", "gateway"]
