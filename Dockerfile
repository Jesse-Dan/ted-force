FROM node:20

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 1110

CMD ["npm", "start"]
