#!/bin/bash
set -e

echo "=== ClawTeam Setup ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Error: Docker is required"; exit 1; }

# Create data directory
mkdir -p data/skills data/users

# Copy env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — please edit it with your credentials"
fi

# Install dependencies
npm install

# Run database migration
npm run db:migrate

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Edit .env with your Google OAuth credentials"
echo "  2. Run: npm run create-admin -- your@email.com"
echo "  3. Run: npm run dev"
