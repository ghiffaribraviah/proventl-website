FROM node:26-bookworm-slim

WORKDIR /app/apps/web

COPY apps/web/package*.json ./
RUN npm install

COPY apps/web ./

EXPOSE 5173

CMD ["npm", "run", "dev"]
