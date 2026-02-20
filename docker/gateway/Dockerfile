FROM node:24
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@latest
RUN useradd -m openclaw
USER openclaw
WORKDIR /home/openclaw
ENTRYPOINT ["openclaw", "gateway"]
