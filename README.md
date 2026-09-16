# google-chrome-mcp

Google Chrome Stable graphique, **Chrome DevTools MCP** et accès VNC/noVNC dans un conteneur Docker ou Podman.

## Fonctionnement

Le conteneur unique démarre :

1. un bureau virtuel Xvfb en `1920x1080` ;
2. x11vnc sur le port `5900` ;
3. noVNC/websockify sur le port `6080` ;
4. un gateway Bun/TypeScript en Streamable HTTP sur le port `3000`.

Le gateway crée dynamiquement un Chrome et un serveur `chrome-devtools-mcp` officiel par session. Chaque session possède un profil Chrome et un port CDP distincts, puis les appels sont routés avec un identifiant `session_id` court de 8 caractères hexadécimaux. L’UUID complet reste interne au gateway.

Le MCP officiel fonctionne en stdio. `mcp-proxy` fournit le transport HTTP attendu par les clients MCP, sur `http://localhost:3000/mcp`.

## Prérequis

- Docker avec Docker Compose, ou Podman avec Podman Compose ;
- un client MCP compatible Streamable HTTP ;
- un client VNC si l’accès noVNC n’est pas utilisé.

## Démarrage

```bash
cp .env.example .env
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

## Sessions isolées

Depuis le client MCP connecté au gateway :

1. appeler `create_session` ;
2. conserver le `session_id` de 8 caractères retourné ;
3. appeler directement les outils Chrome DevTools avec `session_id` ;
4. appeler `destroy_session` en fin de travail.

Les outils de gestion disponibles sont `create_session`, `destroy_session`, `list_sessions` et `session_status`. Les 29 outils Chrome DevTools officiels sont exposés directement, avec `session_id` ajouté à leur schéma. La limite par défaut est de quatre sessions (`MAX_SESSIONS`) et le TTL d’inactivité est de 30 minutes (`SESSION_TTL_MS`).

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

Les smoke tests vérifient noVNC et la négociation MCP `initialize`. Le test multi-session utilise le SDK MCP officiel pour créer deux Chromes, vérifier leurs pages indépendantes, puis les détruire :

```bash
bun run tests/multi-session.ts
```

## Sécurité

Le conteneur n’ajoute pas de reverse proxy ni d’authentification applicative. Les ports sont volontairement exposés par Compose afin que l’utilisateur puisse gérer lui-même le reverse proxy, TLS, le réseau et les contrôles d’accès.

VNC et noVNC sont accessibles sans authentification. N’exposez pas ces ports directement sur Internet sans protection.

## CI et image GHCR

GitHub Actions construit l’image, exécute les smoke tests avec Docker, puis publie sur le GitHub Container Registry pour les pushes sur `develop` :

```text
ghcr.io/frflo/google-chrome-mcp:latest
ghcr.io/frflo/google-chrome-mcp:sha-<commit>
```

Le package GHCR est privé par défaut. La CI utilise `GITHUB_TOKEN` et ne nécessite aucun secret utilisateur supplémentaire.
