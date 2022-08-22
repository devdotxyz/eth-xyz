#!/bin/bash
git pull;
npm update;
node ace build --production --ignore-ts-errors;
rm -rf build-previous
cp .env build/.env;
mv build-live build-previous;
mv build build-live;
forever stopall;
cd build-live;
forever start server.js;
