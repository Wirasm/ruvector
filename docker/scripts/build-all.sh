#!/bin/bash
set -e

# Build all RuVector Docker images locally
# Usage: ./build-all.sh [--platform linux/amd64,linux/arm64] [--version v0.1.0]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$DOCKER_DIR")"

# Default values
PLATFORM="linux/amd64"
VERSION="latest"
REGISTRY="ruvnet"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--platform PLATFORM] [--version VERSION] [--registry REGISTRY]"
      exit 1
      ;;
  esac
done

# Strip 'v' prefix from version if present
VERSION="${VERSION#v}"

# Images to build
declare -a IMAGES=(
  "ruvector-core"
  "ruvector-server"
  "ruvector-cli"
  "ruvector-gnn"
  "ruvector-graph"
  "ruvector-attention"
  "ruvector-cluster"
  "ruvector-sona"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Building RuVector Docker Images${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Platform: ${YELLOW}${PLATFORM}${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo -e "Registry: ${YELLOW}${REGISTRY}${NC}"
echo ""

# Function to build a single image
build_image() {
  local image_name=$1
  local dockerfile="${DOCKER_DIR}/images/${image_name}/Dockerfile"

  echo -e "${YELLOW}Building ${image_name}...${NC}"

  # Check if Dockerfile exists
  if [ ! -f "${dockerfile}" ]; then
    echo -e "${RED}Error: ${dockerfile} not found${NC}"
    return 1
  fi

  # Build command
  docker buildx build \
    --platform "${PLATFORM}" \
    --file "${dockerfile}" \
    --tag "${REGISTRY}/${image_name}:${VERSION}" \
    --tag "${REGISTRY}/${image_name}:latest" \
    --load \
    "${ROOT_DIR}"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully built ${image_name}${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed to build ${image_name}${NC}"
    return 1
  fi
}

# Build images in parallel if building for single platform
if [[ "${PLATFORM}" != *","* ]]; then
  echo -e "${YELLOW}Building images in parallel...${NC}"
  echo ""

  # Array to track background jobs
  pids=()

  for image in "${IMAGES[@]}"; do
    build_image "$image" &
    pids+=($!)
  done

  # Wait for all builds to complete
  failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      failed=$((failed + 1))
    fi
  done

  if [ $failed -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}All images built successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
  else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}${failed} image(s) failed to build${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
  fi
else
  # Build sequentially for multi-platform
  echo -e "${YELLOW}Building images sequentially (multi-platform)...${NC}"
  echo ""

  failed=0
  for image in "${IMAGES[@]}"; do
    if ! build_image "$image"; then
      failed=$((failed + 1))
    fi
    echo ""
  done

  if [ $failed -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}All images built successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
  else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}${failed} image(s) failed to build${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
  fi
fi

# List built images
echo ""
echo -e "${YELLOW}Built images:${NC}"
docker images | grep "${REGISTRY}/ruvector" | head -16
