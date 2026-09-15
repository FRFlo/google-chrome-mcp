# google-chrome-mcp

Projet d’intégration de **Google Chrome** avec le **MCP Chrome DevTools**, exécutable dans un conteneur **Docker** ou **Podman** et contrôlable à distance via **VNC**.

## Objectif

Fournir un environnement Chrome isolé et reproductible permettant :

- l’automatisation et l’inspection via le MCP Chrome DevTools ;
- l’exécution dans Docker ou Podman ;
- le contrôle graphique manuel via VNC lorsque nécessaire.

## Architecture

```text
Client MCP ──> MCP Chrome DevTools ──> Google Chrome
                                      │
                                      └──> affichage distant via VNC
```

Le navigateur est destiné à fonctionner dans un conteneur, avec son affichage rendu disponible par VNC. Le MCP Chrome DevTools fournit l’interface d’automatisation et d’inspection, tandis que VNC permet de reprendre le contrôle manuellement.

## Prérequis

- Docker ou Podman ;
- un client MCP compatible ;
- un visualiseur VNC pour le contrôle graphique ;
- les dépendances du MCP Chrome DevTools utilisées par l’environnement.

## Utilisation

Les fichiers de déploiement et les scripts d’exécution seront ajoutés au fur et à mesure de l’implémentation. Le principe d’exécution cible est :

```bash
# Docker
docker build -t google-chrome-mcp .
docker run --rm -p <port-vnc>:<port-vnc> google-chrome-mcp

# Podman
podman build -t google-chrome-mcp .
podman run --rm -p <port-vnc>:<port-vnc> google-chrome-mcp
```

> Les ports et variables d’environnement exacts dépendront de la configuration du conteneur et du serveur VNC.

## Sécurité

N’exposez pas directement le port VNC sur Internet. Préférez un réseau privé, un tunnel sécurisé ou une authentification VNC robuste. Les secrets et identifiants doivent rester hors du dépôt Git.

## État du projet

Dépôt initialisé. L’environnement Chrome conteneurisé, l’intégration MCP et la configuration VNC seront documentés et versionnés dans les prochaines étapes.

## Licence

À définir.
