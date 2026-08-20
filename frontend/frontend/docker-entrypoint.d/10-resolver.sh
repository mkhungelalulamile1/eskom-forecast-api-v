#!/bin/sh
# Inject the in-cluster DNS resolver into nginx so the /api reverse-proxy
# upstream (a Kubernetes Service name) can be resolved at REQUEST time.
#
# The official nginx image sources every /docker-entrypoint.d/*.sh before
# launching nginx, so this runs on every container start, ahead of nginx. It
# reads the pod's nameserver (kube-dns / CoreDNS) from /etc/resolv.conf -- which
# only exists at runtime, never during `docker build` -- and writes a
# http-context `resolver` directive that nginx.conf's variable proxy_pass relies
# on. Kept out of the image build precisely because the value is runtime-only.
set -e

nameserver=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)

if [ -z "$nameserver" ]; then
    echo "10-resolver.sh: no nameserver found in /etc/resolv.conf; skipping" >&2
    exit 0
fi

echo "resolver ${nameserver} valid=30s ipv6=off;" > /etc/nginx/conf.d/resolver.conf
echo "10-resolver.sh: nginx resolver set to ${nameserver}"
