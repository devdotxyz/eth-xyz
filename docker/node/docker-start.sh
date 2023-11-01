#!/bin/bash
echo "\n\n\nNpm install:"
npm install

echo "\n\n\nGenerate key:"
node ace generate:key

echo "\n\n\nStart node server:"
node ace serve --watch --encore-args="--host 0.0.0.0 --port 8113 --public 127.0.0.1:8113"
