FROM node:24
RUN apt-get update && apt-get install -y git socat && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@2026.6.11
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
