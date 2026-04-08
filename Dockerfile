FROM node:20

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build TypeScript
RUN frg build

EXPOSE 1110

CMD ["npm", "start"]
