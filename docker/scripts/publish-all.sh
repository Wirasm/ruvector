#!/bin/bash
set -e

# Push all RuVector Docker images to Docker Hub
# Usage: ./publish-all.sh [--version v0.1.0] [--dry-run]
# Requires: DOCKER_USERNAME and DOCKER_PASSWORD environment variables

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
VERSION="latest"
REGISTRY="ruvnet"
DRY_RUN=false

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
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--version VERSION] [--registry REGISTRY] [--dry-run]"
      exit 1
      ;;
  esac
done

# Strip 'v' prefix from version if present
VERSION="${VERSION#v}"

# Images to publish
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
echo -e "${GREEN}Publishing RuVector Docker Images${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo -e "Registry: ${YELLOW}${REGISTRY}${NC}"
echo -e "Dry Run: ${YELLOW}${DRY_RUN}${NC}"
echo ""

# Check if running in dry-run mode
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN MODE - No images will be pushed${NC}"
  echo ""
  for image in "${IMAGES[@]}"; do
    echo -e "${YELLOW}Would push:${NC}"
    echo "  - ${REGISTRY}/${image}:${VERSION}"
    echo "  - ${REGISTRY}/${image}:latest"
  done
  exit 0
fi

# Check for required environment variables
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
  echo -e "${RED}Error: DOCKER_USERNAME and DOCKER_PASSWORD environment variables must be set${NC}"
  echo "Example:"
  echo "  export DOCKER_USERNAME=your-username"
  echo "  export DOCKER_PASSWORD=your-password"
  echo "  ./publish-all.sh --version v0.1.0"
  exit 1
fi

# Login to Docker Hub
echo -e "${YELLOW}Logging in to Docker Hub...${NC}"
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to login to Docker Hub${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Successfully logged in${NC}"
echo ""

# Function to push a single image
push_image() {
  local image_name=$1

  echo -e "${YELLOW}Pushing ${image_name}...${NC}"

  # Check if image exists locally
  if ! docker image inspect "${REGISTRY}/${image_name}:${VERSION}" > /dev/null 2>&1; then
    echo -e "${RED}Error: Image ${REGISTRY}/${image_name}:${VERSION} not found locally${NC}"
    echo -e "${YELLOW}Run ./build-all.sh first${NC}"
    return 1
  fi

  # Push version tag
  docker push "${REGISTRY}/${image_name}:${VERSION}"

  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to push ${image_name}:${VERSION}${NC}"
    return 1
  fi

  # Push latest tag if it exists
  if docker image inspect "${REGISTRY}/${image_name}:latest" > /dev/null 2>&1; then
    docker push "${REGISTRY}/${image_name}:latest"

    if [ $? -ne 0 ]; then
      echo -e "${RED}✗ Failed to push ${image_name}:latest${NC}"
      return 1
    fi
  fi

  echo -e "${GREEN}✓ Successfully pushed ${image_name}${NC}"
  return 0
}

# Push all images
failed=0
for image in "${IMAGES[@]}"; do
  if ! push_image "$image"; then
    failed=$((failed + 1))
  fi
  echo ""
done

# Logout from Docker Hub
docker logout

# Summary
echo -e "${GREEN}========================================${NC}"
if [ $failed -eq 0 ]; then
  echo -e "${GREEN}All images published successfully!${NC}"
  echo ""
  echo -e "${YELLOW}Published images:${NC}"
  for image in "${IMAGES[@]}"; do
    echo "  - ${REGISTRY}/${image}:${VERSION}"
    echo "  - ${REGISTRY}/${image}:latest"
  done
else
  echo -e "${RED}${failed} image(s) failed to publish${NC}"
  exit 1
fi
echo -e "${GREEN}========================================${NC}"
