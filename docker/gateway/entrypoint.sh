#!/bin/sh
# OpenClaw 2026.2.19+ blocks ws:// to non-loopback addresses.
# Gateway binds to loopback (127.0.0.1:6100) to pass the security check.
# socat bridges external Docker network traffic (0.0.0.0:6101) to loopback.
socat TCP-LISTEN:6101,fork,bind=0.0.0.0,reuseaddr TCP:127.0.0.1:6100 &

# Start gateway in background so we can auto-approve the local CLI device.
openclaw gateway &
GATEWAY_PID=$!

# Wait for gateway to be ready (up to 60s).
for i in $(seq 1 60); do
  if curl -sf -o /dev/null -w '' http://127.0.0.1:6100/ 2>/dev/null || \
     curl -sf -o /dev/null -w '' http://127.0.0.1:6100/ 2>&1 | grep -q '401'; then
    break
  fi
  sleep 1
done

# Auto-approve the local CLI device so commands like `openclaw cron` work.
openclaw devices approve --latest 2>/dev/null || true

# Keep gateway as the main process (PID 1 behavior for signals).
wait $GATEWAY_PID
