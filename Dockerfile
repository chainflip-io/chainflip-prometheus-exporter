FROM node:18.17.0

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Install pnpm
RUN npm install -g pnpm


RUN pnpm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

RUN pnpm build

EXPOSE 9000

CMD [ "pnpm", "start" ]