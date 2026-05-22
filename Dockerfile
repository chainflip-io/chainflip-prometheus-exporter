FROM node:22.13.0

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@9

RUN pnpm install --frozen-lockfile
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

RUN pnpm build

EXPOSE 9000

CMD [ "pnpm", "start" ]