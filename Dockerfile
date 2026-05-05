# syntax=docker/dockerfile:1.7

########## deps: instalacja zależności z cache npm ##########
FROM node:20-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
# Szybsze przebudowy dzięki cache
RUN --mount=type=cache,target=/root/.npm npm ci

########## builder: budowanie Next.js ##########
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# node_modules z etapu deps
COPY --from=deps /app/node_modules ./node_modules
# reszta źródeł
COPY . .

# Budowa aplikacji (generuje .next/standalone oraz .next/static)
RUN npm run build

########## runner: minimalny runtime ##########
FROM node:20-alpine AS runner
WORKDIR /app

# Bezpieczniejsze ustawienia i czytelna konfiguracja runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Łatwe nadpisanie na środowisku (Azure/App Service/`docker run -e`)
ENV HEALTHCHECK_PATH=/api/health

# Kopiujemy tylko to, co potrzebne w runtime
#   - standalone zawiera serwer Next i potrzebne node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Uruchamiaj jako zwykły użytkownik
USER node

EXPOSE 3000

# Healthcheck bez curl/wget — tylko node i fetch()
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch(`http://127.0.0.1:${process.env.PORT}${process.env.HEALTHCHECK_PATH}`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# W output: 'standalone' punkt wejścia to server.js w katalogu root
CMD ["node", "server.js"]
