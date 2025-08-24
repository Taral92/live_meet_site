FROM node:20-alpine
# Set working directory
WORKDIR /app

# Copy package files & install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Expose your backend port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]