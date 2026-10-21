#!/usr/bin/env bash
#
# Nested-Docker / Docker-in-Docker networking helper.
#
# On some hosts (Docker-in-Docker, rootless Docker, KVM/WSL2 sandboxes) the
# "br_netfilter" bridge hooks are enabled:
#
#     net.bridge.bridge-nf-call-iptables = 1
#
# In that mode Docker's own filter chain contains the rule
#
#     -A DOCKER ! -i br-<id> -o br-<id> -j DROP
#
# which matches *every* packet that is switched between two containers of the
# same user-defined bridge (the ingress device is the veth, not the bridge), so
# container -> container TCP is silently dropped. The symptom is:
#
#     * `docker exec backend nc -z mongo 27017`  -> timeout
#     * nginx returns "504 Gateway Time-out" instead of proxying to the API
#     * the backend logs: "MongoDB connection error: MongooseServerSelectionError"
#
# Turning the bridge hooks off restores normal same-bridge container traffic
# while keeping all container isolation intact.
#
# Usage:  sudo ./docker/fix-container-networking.sh
#
set -euo pipefail

check() {
  local value
  value="$(sysctl -n "net.bridge.bridge-nf-call-iptables" 2>/dev/null || echo "missing")"
  echo "net.bridge.bridge-nf-call-iptables = ${value}"
  if [ "${value}" = "1" ]; then
    return 1
  fi
  return 0
}

if check; then
  echo "OK: container-to-container networking on user-defined bridges is not filtered."
  exit 0
fi

echo
echo "Detected br_netfilter filtering of same-bridge container traffic."
echo "Applying the fix..."

sudo sysctl -w net.bridge.bridge-nf-call-iptables=0
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0

# Make the change persistent across reboots where possible.
if [ -d /etc/sysctl.d ]; then
  printf 'net.bridge.bridge-nf-call-iptables = 0\nnet.bridge.bridge-nf-call-ip6tables = 0\n' \
    | sudo tee /etc/sysctl.d/99-docker-bridge.conf >/dev/null
  echo "Persisted to /etc/sysctl.d/99-docker-bridge.conf"
fi

echo
check && echo "Fixed: container-to-container traffic is now allowed."
echo "Restart the stack so the backend reconnects to MongoDB:"
echo "    docker compose restart backend"
