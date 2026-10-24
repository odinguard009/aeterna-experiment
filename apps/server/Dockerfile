# Aeterna server image (roadmap M7). Runs the HTTP API + WebSocket room server against Postgres (or the
# in-memory reference store when DATABASE_URL is unset). The engine is joined from source at startup -
# tools/build.mjs reads packages/ (protocol + engine) and embeds data/cards - so the offline single file
# (index.html) is never built or shipped here. Nothing is deployed by this file: hosting, a domain and
# the email sender stay the owner's decision (docs/ai/monorepo-plan.md).
#
# Built with the repository root as the build context (the .dockerignore there is the build filter):
#   docker build -f apps/server/Dockerfile .
FROM node:22-alpine

WORKDIR /app

# The server's only npm dependencies (ws for rooms, pg for Postgres). Installed standalone so the
# monorepo workspace root - and its playwright/typescript devDependencies - never enters the image.
COPY apps/server/package.json ./apps/server/package.json
RUN cd apps/server && npm install --omit=dev

# The engine and the card pack come from source; apps/web/src must also exist (src_parts lists it and
# the engine filters it out). data/sources and the other heavy dirs are dropped by .dockerignore.
COPY packages ./packages
COPY apps ./apps
COPY data/cards ./data/cards
COPY tools ./tools

ENV PORT=8080
EXPOSE 8080 8081
CMD ["node", "apps/server/src/serve.mjs"]
