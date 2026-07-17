# Pinned: openclaw 2026.7.1 requires node >=24.15.0 <25 (or >=22.22.3 <23, >=25.9.0).
# The floating node:24 tag would satisfy that today but is not reproducible.
FROM node:24.18
RUN apt-get update && apt-get install -y git socat && rm -rf /var/lib/apt/lists/*
RUN npm install -g openclaw@2026.7.1
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
