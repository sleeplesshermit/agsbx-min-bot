# OPTIONAL minimal Docker variant of agsbx-min-bot (for VPS providers that
# take a Docker image instead of a bot-room upload).
# NOTE: not build-tested on the machine that authored it (no Docker there).
# The bot-room package (index.js + start.sh) is the primary artifact.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates procps nodejs \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY index.js package.json server.js start.sh ./
# Same env contract as the bot room: UUID / AGN / AGK (+ optional VMPT).
# In Docker there is no provider $PORT health check; the placeholder server
# simply stays unused unless PORT is passed.
CMD ["node", "index.js"]
