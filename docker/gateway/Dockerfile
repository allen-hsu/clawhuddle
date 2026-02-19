FROM node:22
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@latest
WORKDIR /root
ENTRYPOINT ["openclaw", "gateway"]
