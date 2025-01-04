#!/bin/bash

NODE_VERSION=$(cat ./.nvmrc)
NODE_LOC=$(npm config get prefix)
OS_NAME=$(echo "require('os').platform()" | node -p -)

NODE_DEST="$HOME"/azure-pipelines-task-lib/_download/node16/node-v"$NODE_VERSION"-"$OS_NAME"-x64

[ -d "$NODE_DEST" ] && unlink "$NODE_DEST"

[ ! -d $(dirname "$NODE_DEST") ] && mkdir -p $(dirname "$NODE_DEST")

ln -s "$NODE_LOC" "$NODE_DEST"
touch "$HOME"/azure-pipelines-task-lib/_download/node16.completed