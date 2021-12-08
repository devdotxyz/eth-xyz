# eth.xyz Wildcard

### Basic Setup

* `cp .env.example .env`
* Add API keys to .env (Technically OpenSea is optional, but app will currently fail without it)
* `docker-compose up`
* `localhost:8112/brantly.eth`
(insert.eth name as you see fit)
  
### Access Container
* `docker-compose exec eth-xyz-node bash`

### Process domain setup queue

* `node ace process:queue`

### Build for Production
* `node ace build --production --ignore-ts-errors`
* `cd build`
* `cp ../.env .env`
* `npm ci --production`

I recommend using `forever` to run basic servers. Otherwise you can use `pm2`

**Forever method:**

* `npm install -g forever`
* `forever start server.js`
  
**Basic Method:**

* `node server.js`


**PM2 / Additional Methods:**

* https://docs.adonisjs.com/guides/deployment#using-a-process-manager

### Troubleshooting
* Intermittent `Error: Cannot find module '../lib/config/parse-runtime'` errors can be solved by accessing the docker container and running `rm -rf node_modules;npm install`

### Architecture Notes

The frontend of this application is written in Vanilla javascript. The bulk of the application is in `loader.js`.

`constructor()` is the entrypoint that kicks off everything.

Templates are rendered using `underscore.js`

### Resources

* https://metadata.ens.domains/docs
* https://docs.opensea.io/reference/api-overview
