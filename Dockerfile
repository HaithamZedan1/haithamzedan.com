# The site as a portable container image: nginx without root privileges, serving dist/.
# The pipeline scans it and starts it once as a check; the site itself is served by Cloudflare Pages.
# The pipeline runs ci/assemble.sh first, so dist/ exists when this builds.
FROM nginxinc/nginx-unprivileged:stable-alpine

# Take the security fixes Alpine has published since the base image was built.
USER 0
# hadolint ignore=DL3017
RUN apk upgrade --no-cache
USER 101

COPY nginx/site.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=5 \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/build.json"]
