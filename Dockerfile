# Use an official Node.js runtime as the base image
FROM node:18.19.1-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the project files to the container
COPY . .

# Clear npm cache (optional)
# Install project dependencies
RUN npm cache clean --force && npm install

# Expose any necessary ports
EXPOSE 1234

# Start your application
CMD ["npm", "start"]
