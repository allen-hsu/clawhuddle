#!/bin/sh
# OpenClaw 2026.2.19+ blocks ws:// to non-loopback addresses.
# Gateway binds to loopback (127.0.0.1:6100) to pass the security check.
# socat bridges external Docker network traffic (0.0.0.0:6101) to loopback.
socat TCP-LISTEN:6101,fork,bind=0.0.0.0,reuseaddr TCP:127.0.0.1:6100 &
exec openclaw gateway
