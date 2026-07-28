#!/usr/bin/env bash
set -euo pipefail
if [ ! -f /sys/kernel/btf/vmlinux ]; then
  echo "ERROR: BTF not available on this kernel. See Phase 0." >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: must run as root (sudo ./run.sh) to load eBPF programs." >&2
  exit 1
fi
exec ./build/sentinel_collector
