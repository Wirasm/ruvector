# RuVector Docker Publishing Scripts

This directory contains scripts for building, testing, and publishing RuVector Docker images.

## Scripts

### 1. build-all.sh

Builds all 8 RuVector Docker images locally.

**Usage:**
```bash
# Build for single platform (default: linux/amd64)
./build-all.sh

# Build for specific platform
./build-all.sh --platform linux/arm64

# Build for multiple platforms (requires buildx)
./build-all.sh --platform linux/amd64,linux/arm64

# Build with specific version
./build-all.sh --version v0.1.5

# Build with custom registry
./build-all.sh --registry myregistry
```

**Features:**
- Builds all 8 images in parallel for single platform
- Sequential build for multi-platform (more stable)
- Automatic tagging with version and latest
- Color-coded output with progress indicators
- Error handling and reporting

**Images Built:**
- ruvector-core
- ruvector-server
- ruvector-cli
- ruvector-gnn
- ruvector-graph
- ruvector-attention
- ruvector-cluster
- ruvector-sona

### 2. publish-all.sh

Pushes all built images to Docker Hub.

**Usage:**
```bash
# Set credentials (required)
export DOCKER_USERNAME=ruvnet
export DOCKER_PASSWORD=your-token-here

# Publish with default settings (latest)
./publish-all.sh

# Publish specific version
./publish-all.sh --version v0.1.5

# Dry run to see what would be pushed
./publish-all.sh --dry-run --version v0.1.5

# Use custom registry
./publish-all.sh --registry myregistry
```

**Features:**
- Automatic login to Docker Hub
- Pushes both version and latest tags
- Dry-run mode for testing
- Validates images exist locally before pushing
- Automatic logout after completion

**Requirements:**
- `DOCKER_USERNAME` environment variable
- `DOCKER_PASSWORD` environment variable (use Docker Hub access token)
- Images must be built locally first (run build-all.sh)

### 3. test-images.sh

Tests all Docker images to verify they work correctly.

**Usage:**
```bash
# Test all images
./test-images.sh

# Test specific version
./test-images.sh --version v0.1.5

# Test with custom timeout
./test-images.sh --timeout 60

# Test from custom registry
./test-images.sh --registry myregistry
```

**Features:**
- Tests each image with appropriate flags (--help, --version)
- Special health check for server image
- Configurable timeout
- Detailed output and error reporting
- Summary report at the end

**Tests Performed:**
- Image existence check
- Basic execution test (--help flag)
- Server startup and health check
- Exit code validation

## GitHub Actions Workflow

The `.github/workflows/docker-publish.yml` workflow automates the entire build, test, and publish process.

### Triggers

1. **Tag Push:** Automatically runs when you push a tag matching `v*`
   ```bash
   git tag v0.1.5
   git push origin v0.1.5
   ```

2. **Manual Dispatch:** Run manually from GitHub Actions tab
   - Go to Actions → Docker Publish → Run workflow
   - Enter version (e.g., v0.1.5)

### What It Does

1. **Build Stage:**
   - Builds all 8 images using matrix strategy
   - Supports linux/amd64 and linux/arm64 platforms
   - Uses Docker buildx for multi-platform builds
   - Implements layer caching for faster builds
   - Tags with version and latest

2. **Test Stage:**
   - Pulls each published image
   - Runs basic functionality tests
   - Validates server startup
   - Checks image sizes

3. **Release Stage:**
   - Creates GitHub Release with notes
   - Lists all published images
   - Includes usage examples
   - Links to docker-compose.yml

### Secrets Required

Configure these in your GitHub repository settings (Settings → Secrets → Actions):

- `DOCKER_PASSWORD` - Docker Hub access token (or password)

### Matrix Strategy

The workflow uses a matrix to build all images in parallel:
```yaml
strategy:
  matrix:
    image:
      - ruvector-core
      - ruvector-server
      - ruvector-cli
      - ruvector-gnn
      - ruvector-graph
      - ruvector-attention
      - ruvector-cluster
      - ruvector-sona
```

## Complete Publishing Workflow

### Local Development

```bash
# 1. Build all images
cd /workspaces/ruvector/docker/scripts
./build-all.sh --version v0.1.5

# 2. Test images
./test-images.sh --version v0.1.5

# 3. Publish (requires credentials)
export DOCKER_USERNAME=ruvnet
export DOCKER_PASSWORD=your-docker-hub-token
./publish-all.sh --version v0.1.5
```

### CI/CD (Recommended)

```bash
# 1. Commit your changes
git add .
git commit -m "Release v0.1.5"

# 2. Create and push tag
git tag v0.1.5
git push origin v0.1.5

# 3. GitHub Actions automatically:
#    - Builds all images for amd64 and arm64
#    - Tests all images
#    - Publishes to Docker Hub
#    - Creates GitHub Release
```

## Platform Support

All images are built for:
- **linux/amd64** - Intel/AMD 64-bit
- **linux/arm64** - ARM 64-bit (Apple Silicon, AWS Graviton, etc.)

## Docker Hub Repository

Published images are available at:
- https://hub.docker.com/r/ruvnet/ruvector-core
- https://hub.docker.com/r/ruvnet/ruvector-server
- https://hub.docker.com/r/ruvnet/ruvector-cli
- https://hub.docker.com/r/ruvnet/ruvector-gnn
- https://hub.docker.com/r/ruvnet/ruvector-graph
- https://hub.docker.com/r/ruvnet/ruvector-attention
- https://hub.docker.com/r/ruvnet/ruvector-cluster
- https://hub.docker.com/r/ruvnet/ruvector-sona

## Troubleshooting

### Build Failures

```bash
# Check Docker buildx
docker buildx ls

# Create new builder if needed
docker buildx create --name ruvector-builder --use

# Inspect builder
docker buildx inspect --bootstrap
```

### Login Issues

```bash
# Use access token instead of password
# Create at: https://hub.docker.com/settings/security

# Test login
echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
```

### Multi-platform Build Issues

```bash
# Install QEMU
docker run --privileged --rm tonistiigi/binfmt --install all

# Verify platforms
docker buildx inspect --bootstrap
```

## Best Practices

1. **Always test locally** before publishing
2. **Use semantic versioning** for tags (v0.1.5, v1.0.0)
3. **Use access tokens** instead of passwords
4. **Enable 2FA** on Docker Hub account
5. **Review changes** in dry-run mode first
6. **Monitor image sizes** to keep them optimized
7. **Use CI/CD** for consistent, automated releases

## Version Management

The scripts automatically handle version formatting:
- Input: `v0.1.5` or `0.1.5`
- Output: `0.1.5` (v prefix stripped)
- Tags created: `0.1.5` and `latest`

## Support

For issues or questions:
- GitHub Issues: https://github.com/ruvnet/ruvector/issues
- Documentation: https://github.com/ruvnet/ruvector
