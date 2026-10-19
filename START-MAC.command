#!/bin/bash
cd "$(dirname "$0")" || exit 1
printf '\nGDG Tech Challenge - local quiz server\n\n'
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js was not found. Install Node.js 18+ before running the quiz.'
  echo 'https://nodejs.org/'
  read -r -p 'Press Enter to close...'
  exit 1
fi
node server.js
printf '\nServer stopped.\n'
read -r -p 'Press Enter to close...'
