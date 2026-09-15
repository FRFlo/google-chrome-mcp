FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    SCREEN_WIDTH=1920 \
    SCREEN_HEIGHT=1080 \
    CHROME_DATA_DIR=/data/chrome \
    DOWNLOAD_DIR=/data/downloads \
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

RUN npm install --global --no-fund --no-audit chrome-devtools-mcp@latest mcp-proxy@latest \
    && mkdir -p /data/chrome /data/downloads /tmp/runtime-node \
    && chown -R node:node /data /tmp/runtime-node

COPY docker/entrypoint.sh /usr/local/bin/google-chrome-mcp
RUN chmod 0755 /usr/local/bin/google-chrome-mcp

USER node
WORKDIR /home/node

EXPOSE 3000 5900 6080

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/google-chrome-mcp"]

