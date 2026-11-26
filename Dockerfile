# The site as a portable container image: nginx without root privileges, serving dist/.
# The pipeline scans it and starts it once as a check; the site itself is served by Cloudflare Pages.
# The pipeline runs ci/assemble.sh first, so dist/ exists when this builds.
FROM nginxinc/nginx-unprivileged:stable-alpine

# Take the security fixes published since the base image was built:
#   - Alpine's packages, from Alpine's repositories;
#   - nginx and its modules, from nginx.org's stable repository. The base image installs them
#     from there pinned to one version, so a plain upgrade leaves them alone; naming them again
#     without the pin lifts it. The base image already trusts nginx.org's signing key.
# Once the base image catches up, both commands change nothing.
USER 0
# hadolint ignore=DL3017,DL3018,SC2046
RUN apk upgrade --no-cache \
 && apk add --no-cache --upgrade \
      --repository "https://nginx.org/packages/alpine/v$(cut -d. -f1,2 /etc/alpine-release)/main" \
      $(grep -o '^nginx[^=<>~]*' /etc/apk/world)
USER 101

COPY nginx/site.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=5 \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/build.json"]
