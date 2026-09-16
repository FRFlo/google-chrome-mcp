# google-chrome-mcp

Google Chrome Stable graphique, **Chrome DevTools MCP** et accès VNC/noVNC dans un conteneur Docker ou Podman.

## Fonctionnement

Le conteneur unique démarre :

1. un bureau virtuel Xvfb en `1920x1080` ;
2. Google Chrome Stable avec le protocole CDP sur le port interne `9222` ;
3. x11vnc sur le port `5900` ;
4. noVNC/websockify sur le port `6080` ;
5. `chrome-devtools-mcp` officiel derrière `mcp-proxy`, en Streamable HTTP sur le port `3000`.

Le MCP officiel fonctionne en stdio. `mcp-proxy` fournit le transport HTTP attendu par les clients MCP, sur `http://localhost:3000/mcp`.

## Prérequis

- Docker avec Docker Compose, ou Podman avec Podman Compose ;
- un client MCP compatible Streamable HTTP ;
- un client VNC si l’accès noVNC n’est pas utilisé.

## Démarrage

```bash
cp .env.example .env
# Modifiez au minimum VNC_PASSWORD dans .env.
docker compose up -d --build
```

Avec Podman Compose :

```bash
cp .env.example .env
podman-compose up -d --build
```

Accès par défaut :

| Service | Adresse |
| --- | --- |
| MCP Streamable HTTP | `http://localhost:3000/mcp` |
| VNC | `localhost:5900` |
| noVNC | `http://localhost:6080/vnc.html` |

Les ports hôte sont configurables dans `.env` via `MCP_PORT`, `VNC_PORT` et `NOVNC_PORT`.

## Persistance

Deux volumes Compose sont créés automatiquement :

- `chrome-data` : profil Chrome et cookies ;
- `chrome-downloads` : téléchargements.

Pour arrêter et supprimer les conteneurs sans supprimer les données :

```bash
docker compose down
```

Pour supprimer également les données persistantes :

```bash
docker compose down -v
```

## Configuration MCP

Exemple générique de configuration client :

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Tests

Après le démarrage du conteneur :

```bash
bash tests/smoke.sh
```

Les smoke tests vérifient CDP, noVNC et la négociation MCP `initialize`.

## Sécurité

Le conteneur n’ajoute pas de reverse proxy ni d’authentification applicative. Les ports sont volontairement exposés par Compose afin que l’utilisateur puisse gérer lui-même le reverse proxy, TLS, le réseau et les contrôles d’accès.

Ne commitez jamais `.env` ou un vrai mot de passe VNC. N’exposez pas ces ports directement sur Internet sans protection.

## CI et image GHCR

GitHub Actions construit l’image, exécute les smoke tests avec Docker, puis publie sur le GitHub Container Registry pour les pushes sur `develop` :

```text
ghcr.io/frflo/google-chrome-mcp:latest
ghcr.io/frflo/google-chrome-mcp:sha-<commit>
```

Le package GHCR est privé par défaut. La CI utilise `GITHUB_TOKEN` et ne nécessite aucun secret utilisateur supplémentaire.
