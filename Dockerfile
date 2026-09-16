FROM oven/bun:1.3.14-debian

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    SCREEN_WIDTH=1920 \
    SCREEN_HEIGHT=1080 \
    MCP_PORT=3000 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dumb-init \
    fluxbox \
    fonts-liberation \
    gnupg \
    nodejs \
    novnc \
    unzip \
    wget \
    websockify \
    x11vnc \
    xvfb \
    && mkdir -p /etc/apt/keyrings \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock /tmp/app/
RUN cd /tmp/app && bun install --frozen-lockfile \
    && mkdir -p /data/sessions /data/downloads /tmp/runtime-node \
    && chown -R bun:bun /data /tmp/runtime-node

WORKDIR /app
COPY package.json bun.lock ./
COPY src ./src
COPY tests ./tests
COPY docker/entrypoint.sh /usr/local/bin/google-chrome-mcp
RUN cp -a /tmp/app/node_modules ./node_modules \
    && chmod 0755 /usr/local/bin/google-chrome-mcp \
    && chown -R bun:bun /app

USER bun

EXPOSE 3000 5900 6080

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/google-chrome-mcp"]

