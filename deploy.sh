cd codenames-website
pnpm install
pnpm run build

cd ..

scp -r ./codenames-website/dist/* adam@pancake.caltech.edu:~/codenames-deploy/website
scp -r ./codenames-server/package.json ./codenames-server/server.js ./codenames-server/wordlist.txt ./codenames-server/locations.json adam@pancake.caltech.edu:~/codenames-deploy/server