# Build the React app and install server deps, then run one Bun process that serves both.
FROM oven/bun:1 AS build
WORKDIR /app

COPY app/package.json app/bun.lock ./app/
RUN cd app && bun install --frozen-lockfile
COPY app ./app
RUN cd app && bun run build

COPY server/package.json server/bun.lock ./server/
RUN cd server && bun install --frozen-lockfile --production
COPY server ./server

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/server ./server
COPY --from=build /app/app/dist ./app/dist
WORKDIR /app/server
EXPOSE 3000
USER bun
CMD ["bun", "index.ts"]
