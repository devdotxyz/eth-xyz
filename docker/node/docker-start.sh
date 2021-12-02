#!/bin/bash
echo "\n\n\nNpm install:"
npm install

echo "\n\n\nGenerate key:"
node ace generate:key

echo "\n\n\nStart node server:"
node ace serve --watch --encore-args="--port 8113"
