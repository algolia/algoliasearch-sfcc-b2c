#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to perform cleanup
cleanup() {
  echo "Cleaning up..."
  # Remove generated folders and files
  rm -rf e2e-tests e2e-tests.zip site_import.zip site_import "$CODE_VERSION" "$CODE_VERSION.zip"
}

# Trap EXIT signal to run cleanup when the script exits, regardless of success or failure
trap cleanup EXIT

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  export $(grep -v '^#' .env | xargs)
fi

# Ensure CODE_VERSION is set
if [ -z "$CODE_VERSION" ]; then
  echo "ERROR: CODE_VERSION is not set. Please define it in your .env file or export it in your shell."
  exit 1
fi

echo "Using CODE_VERSION: $CODE_VERSION"

echo "Linting JavaScript..."
npm run lint:js

echo "Running unit tests..."
npm run test:unit

echo "Compiling JavaScript..."
npm run compile:js --silent

echo "Compiling SCSS..."
npm run compile:scss --silent

echo "Preparing code for deployment..."
mkdir -p "$CODE_VERSION"
cp -R cartridges/* "$CODE_VERSION"/

echo "Zipping the cartridges directory..."
zip -rq "${CODE_VERSION}.zip" "$CODE_VERSION"

echo "Deploying code..."
node scripts/deployCode.js

echo "Importing site preferences..."
node scripts/importPreferences.js

echo "Running SFCC job..."
node scripts/runSFCCJob.js

echo "Running index tests..."
npm run test:variationindex

echo "Running frontend tests..."
npx cypress run

echo "E2E tests completed successfully."
