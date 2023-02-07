#!/bin/bash

set -ex

dist=$1

if [[ -z "$dist" ]]; then
  echo "Specify plugin directory (full path)"
  exit 1
fi

npm run build

target="$dist/obsidian-textlint"

if [[ ! -d "$target" ]]; then
  mkdir "$target"
fi
cp main.js "$target"
cp styles.css "$target"
cp manifest.json "$target"
