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

# Array of test configurations with corresponding product IDs
declare -a record_models=("variation-level" "master-level")
declare -a index_prefixes=("varx" "basex")

# Ensure required environment variables are set
if [ -z "$TEST_PRODUCT_ID" ]; then
  echo "ERROR: TEST_PRODUCT_ID is not set. Please define it in your .env file."
  exit 1
fi

if [ -z "$TEST_MASTER_PRODUCT_ID" ]; then
  echo "ERROR: TEST_MASTER_PRODUCT_ID is not set. Please define it in your .env file."
  exit 1
fi

# Loop through each configuration
for record_model in "${record_models[@]}"; do
  for index_prefix in "${index_prefixes[@]}"; do
    echo "Testing configuration: Record Model=$record_model, Index Prefix=$index_prefix"
    
    # Set the appropriate product ID based on record model
    if [ "$record_model" = "master-level" ]; then
      export CURRENT_TEST_PRODUCT_ID=$TEST_MASTER_PRODUCT_ID
    else
      export CURRENT_TEST_PRODUCT_ID=$TEST_PRODUCT_ID
    fi
    
    echo "Importing site preferences..."
    RECORD_MODEL=$record_model INDEX_PREFIX=$index_prefix node scripts/importPreferences.js

    echo "Running SFCC job..."
    node scripts/runSFCCJob.js

    echo "Running index tests..."
    RECORD_MODEL=$record_model \
    INDEX_PREFIX=$index_prefix \
    TEST_PRODUCT_ID=$CURRENT_TEST_PRODUCT_ID \
    npm run test:variationindex

    echo "Running frontend tests..."
    CYPRESS_RECORD_MODEL=$record_model \
    CYPRESS_INDEX_PREFIX=$index_prefix \
    CYPRESS_TEST_PRODUCT_ID=$CURRENT_TEST_PRODUCT_ID \
    npx cypress run
    
    echo "Configuration test completed: Record Model=$record_model, Index Prefix=$index_prefix"
  done
done

echo "All E2E tests completed successfully."
