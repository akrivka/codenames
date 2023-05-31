cd codenames-website
pnpm install
pnpm run build

cd ..

scp -r ./codenames-website/dist/* adam@pancake.caltech.edu:~/codenames-deploy/website
scp -r ./codenames-website/src ./codenames-website/package.json ./codenames-website/postcss.config.js ./codenames-website/tailwind.config.js ./codenames-website/jsconfig.json ./codenames-website/vite.config.js ./codenames-website/index.html adam@pancake.caltech.edu:~/codenames-deploy/website-src
scp -r ./codenames-server/package.json ./codenames-server/server.js ./codenames-server/wordlist.txt ./codenames-server/locations.json adam@pancake.caltech.edu:~/codenames-deploy/server