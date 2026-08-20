# Frontend image: nginx serving the single-page Eskom Forecaster dashboard and
# reverse-proxying /api/* to the in-cluster backend Service.
#
# Build context is this `frontend/` directory, so the COPYs are relative to it.
FROM nginx:1.27-alpine

# Replace the stock nginx site with ours (static hosting + /api reverse proxy).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The dashboard is fully self-contained (all CSS/JS inlined, external libs from
# CDNs, logo as a data URI), so index.html is the only asset to ship.
COPY index.html /usr/share/nginx/html/index.html

# Runtime hook (sourced by the official nginx entrypoint before nginx starts):
# writes the cluster DNS resolver into conf.d so /api can be resolved at request
# time. See docker-entrypoint.d/10-resolver.sh and nginx.conf for why.
COPY docker-entrypoint.d/10-resolver.sh /docker-entrypoint.d/10-resolver.sh
RUN chmod +x /docker-entrypoint.d/10-resolver.sh

# NOTE: we intentionally do NOT run `nginx -t` here. The /api upstream is a
# Kubernetes Service DNS name that only resolves at runtime inside the cluster;
# testing the config at build time fails with "host not found in upstream". The
# config is exercised at container start (and by the pod's /healthz probes).

EXPOSE 80

# nginx:alpine's default CMD already runs `nginx -g "daemon off;"`, set here for
# clarity. The image's ENTRYPOINT (/docker-entrypoint.sh) runs the hook above.
CMD ["nginx", "-g", "daemon off;"]
