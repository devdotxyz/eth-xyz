#!/bin/bash
git pull;
node ace build --production --ignore-ts-errors;
cd build;
cp ../.env .;
forever stopall;
forever start server.js
cd ..
