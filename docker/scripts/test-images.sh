#!/bin/bash
set -e

# Test all RuVector Docker images
# Usage: ./test-images.sh [--version v0.1.0] [--registry ruvnet]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
VERSION="latest"
REGISTRY="ruvnet"
TIMEOUT=30

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--version VERSION] [--registry REGISTRY] [--timeout SECONDS]"
      exit 1
      ;;
  esac
done

# Strip 'v' prefix from version if present
VERSION="${VERSION#v}"

# Images to test with their expected behavior
declare -A IMAGE_TESTS=(
  ["ruvector-core"]="--help"
  ["ruvector-server"]="--version"
  ["ruvector-cli"]="--help"
  ["ruvector-gnn"]="--help"
  ["ruvector-graph"]="--help"
  ["ruvector-attention"]="--help"
  ["ruvector-cluster"]="--help"
  ["ruvector-sona"]="--help"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Testing RuVector Docker Images${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo -e "Registry: ${YELLOW}${REGISTRY}${NC}"
echo -e "Timeout: ${YELLOW}${TIMEOUT}s${NC}"
echo ""

# Function to test a single image
test_image() {
  local image_name=$1
  local test_arg=$2
  local full_image="${REGISTRY}/${image_name}:${VERSION}"

  echo -e "${YELLOW}Testing ${image_name}...${NC}"

  # Check if image exists
  if ! docker image inspect "$full_image" > /dev/null 2>&1; then
    echo -e "${RED}✗ Image not found: ${full_image}${NC}"
    return 1
  fi

  # Run the image with test argument
  echo -e "${BLUE}Running: docker run --rm ${full_image} ${test_arg}${NC}"

  # Create a temporary file for output
  local output_file=$(mktemp)

  # Run with timeout
  if timeout "$TIMEOUT" docker run --rm "$full_image" $test_arg > "$output_file" 2>&1; then
    echo -e "${GREEN}✓ ${image_name} started successfully${NC}"
    echo -e "${BLUE}Output:${NC}"
    head -5 "$output_file" | sed 's/^/  /'
    rm -f "$output_file"
    return 0
  else
    local exit_code=$?
    if [ $exit_code -eq 124 ]; then
      echo -e "${RED}✗ ${image_name} timed out after ${TIMEOUT}s${NC}"
    else
      echo -e "${RED}✗ ${image_name} failed with exit code ${exit_code}${NC}"
    fi
    echo -e "${BLUE}Output:${NC}"
    cat "$output_file" | sed 's/^/  /'
    rm -f "$output_file"
    return 1
  fi
}

# Special test for server (needs health check)
test_server() {
  local image_name="ruvector-server"
  local full_image="${REGISTRY}/${image_name}:${VERSION}"

  echo -e "${YELLOW}Testing ${image_name}...${NC}"

  # Check if image exists
  if ! docker image inspect "$full_image" > /dev/null 2>&1; then
    echo -e "${RED}✗ Image not found: ${full_image}${NC}"
    return 1
  fi

  # Start server in background
  echo -e "${BLUE}Starting server container...${NC}"
  local container_id=$(docker run -d --rm -p 8080:8080 "$full_image")

  # Wait for server to be ready
  echo -e "${BLUE}Waiting for server to be ready...${NC}"
  local ready=false
  for i in {1..10}; do
    if docker exec "$container_id" pgrep -f ruvector > /dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done

  # Stop container
  docker stop "$container_id" > /dev/null 2>&1 || true

  if [ "$ready" = true ]; then
    echo -e "${GREEN}✓ ${image_name} started successfully${NC}"
    return 0
  else
    echo -e "${RED}✗ ${image_name} failed to start${NC}"
    return 1
  fi
}

# Test all images
failed=0
passed=0

for image_name in "${!IMAGE_TESTS[@]}"; do
  test_arg="${IMAGE_TESTS[$image_name]}"

  if [ "$image_name" = "ruvector-server" ]; then
    if test_server; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
    fi
  else
    if test_image "$image_name" "$test_arg"; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
    fi
  fi
  echo ""
done

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Results${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Total images: ${YELLOW}$((passed + failed))${NC}"
echo -e "Passed: ${GREEN}${passed}${NC}"
echo -e "Failed: ${RED}${failed}${NC}"
echo -e "${GREEN}========================================${NC}"

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}All images passed testing!${NC}"
  exit 0
else
  echo -e "${RED}Some images failed testing${NC}"
  exit 1
fi
