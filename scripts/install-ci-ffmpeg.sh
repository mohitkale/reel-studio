#!/usr/bin/env bash
set -euo pipefail

# Runner setup only: never alter a developer's package sources or install tools.
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "This installer runs only on Linux GitHub Actions runners." >&2
  exit 1
fi

# The runner's Azure mirror can stall while downloading FFmpeg dependencies.
# Prefer Ubuntu's HTTPS archive, with the existing Azure archive as fallback.
# APT still verifies the signed repository metadata and package checksums.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  printf 'https://archive.ubuntu.com/ubuntu/\tpriority:1\nhttp://azure.archive.ubuntu.com/ubuntu/\tpriority:2\n' |
    sudo tee /etc/apt/apt-mirrors.txt > /dev/null
fi

apt_options=(
  -o Acquire::Retries=2
  -o Acquire::http::Timeout=30
  -o Acquire::https::Timeout=30
)
sudo apt-get "${apt_options[@]}" update
sudo env DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" \
  install --yes --no-install-recommends ffmpeg
