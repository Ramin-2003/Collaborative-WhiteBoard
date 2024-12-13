FROM node:16-slim

WORKDIR /app

COPY package*.json ./
COPY app.js ./

RUN npm install --production

ENV PORT=10000

EXPOSE 10000

CMD ["npm", "start"]