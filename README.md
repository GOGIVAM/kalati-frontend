# KALATI Chat — Frontend React

Interface agent du système de Recherche et Génération Augmentée (RAG) agentique de CAMRAIL.
SPA React destinée au réseau intranet CAMRAIL, sans accès Internet en production.

## Stack

| Couche | Choix |
| --- | --- |
| Build | Vite 5 |
| Langage | TypeScript (strict) |
| Routage | react-router-dom 6 |
| Données serveur | TanStack Query 5 |
| État client | Zustand |
| i18n | react-i18next (fr / en) |
| Icônes | lucide-react |
| Styles | CSS variables + CSS global, aucune dépendance UI |

Le backend applicatif attendu est en **.NET** (API Gateway, JWT ES256, RBAC, journal d'audit),
le service RAG en **Python / FastAPI**, la persistance en **PostgreSQL** + **Qdrant**.
Le frontend ne parle **qu'au backend .NET**.

## Démarrage local

```bash
cp .env.example .env
npm install
npm run dev
```

L'application écoute sur `http://localhost:5173`.

Deux façons de joindre le backend :

1. **Proxy Vite (recommandé en local)** — laissez `VITE_API_URL` vide et pointez
   `VITE_PROXY_TARGET` sur votre API .NET (par défaut `http://localhost:5080`).
   Toutes les requêtes `/api/*` sont relayées, ce qui évite CORS et permet
   les cookies `httpOnly` en même origine.
2. **URL directe** — renseignez `VITE_API_URL=https://kalati-api.intranet.camrail.cm`.
   Le backend doit alors autoriser l'origine du frontend en CORS
   (`Access-Control-Allow-Credentials: true` si transport cookie).

### Transport du JWT

`VITE_AUTH_TRANSPORT` accepte deux valeurs, conformément au cahier des charges (§ V.1) :

- `header` — le token est conservé en mémoire (jamais en `localStorage`) et envoyé
  dans `Authorization: Bearer <jwt>`. Au rechargement de page, la session est
  restaurée via `GET /api/auth/me` (cookie de session de rafraîchissement côté serveur)
  ou l'utilisateur est renvoyé vers l'écran de connexion.
- `cookie` — le backend pose un cookie `httpOnly; Secure; SameSite=Strict`.
  Le frontend n'accède jamais au token ; toutes les requêtes partent avec
  `credentials: 'include'`.

## Structure

```
src/
  components/
    auth/        ProtectedRoute, RoleGate
    chat/        composer, messages, citations, badges modèle/fidélité, refus calibré
    common/      primitives d'interface (Button, Input, Table, Dialog, Tag…)
    layout/      AppShell, TopNav, ConversationRail, SourcePanel
  hooks/         useAuth, useChatStream, useTypewriter, useConversations
  i18n/          configuration + dictionnaires fr.json / en.json
  lib/           httpClient (fetch + JWT + erreurs), queryClient, format, env
  pages/         un fichier par écran
  services/      un module par domaine d'API — SEULE couche qui connaît les URLs
  store/         authStore, uiStore (Zustand)
  styles/        tokens.css (couleurs CAMRAIL, type, espacement), global.css
  types/         modèles de données partagés avec le backend
```

Règle d'architecture : **aucun composant n'appelle `fetch` directement**.
Tout passe par `src/services/*`, qui utilise `src/lib/httpClient.ts`.
Pour changer un endpoint, un seul fichier est à modifier.

## Écrans

| Route | Écran | Rôle requis |
| --- | --- | --- |
| `/login` | Connexion (matricule + mot de passe) | — |
| `/` | Chat KALATI — réponses sourcées, citations, indicateur de modèle | AGENT |
| `/historique` | Historique des conversations | AGENT |
| `/documents` | Bibliothèque documentaire et statut d'ingestion | AGENT |
| `/documents/:id` | Visionneuse de document (panneau source) | AGENT |
| `/indicateurs` | Tableau de bord d'indicateurs | AGENT |
| `/audit` | Journal d'audit SHA-256 chaîné | AUDITEUR |
| `/administration` | Agents, grades, départements, catégories | ADMIN |
| `/parametres` | Profil agent, langue, préférences | AGENT |

Le contrôle d'accès de l'interface (`RoleGate`) est **cosmétique** : il masque ce qui
n'est pas pertinent. Le contrôle réel est celui du backend .NET et du filtre RBAC
injecté dans Qdrant (cahier des charges § IV.4), non contournable depuis le frontend.

## Contrat d'API

Le backend n'existant pas encore, le contrat que ce frontend consomme est spécifié
dans **[`API_CONTRACT.md`](./API_CONTRACT.md)** : routes, corps de requête, corps de
réponse, codes d'erreur et format du flux SSE de génération. L'équipe .NET peut
l'implémenter tel quel ; en cas d'écart, seuls les fichiers de `src/services/` changent.

## Conformité au cahier des charges

- Bandeau de transparence IA à la première connexion, réaffichable depuis les paramètres (§ IV.3).
- Indicateur du modèle utilisé (léger / raisonnement) sur chaque réponse (§ IV.3).
- Score de fidélité affiché ; sous `0,90`, l'interface rend un **refus calibré explicite**
  au lieu d'une réponse (§ IV.3, § VIII).
- Citations cliquables document / section / article / page ouvrant le panneau source (§ IV.1).
- Filtres par périmètre métier (maintenance, transport, RH, juridique, finance, commercial) (§ II).
- Aucun appel réseau vers un service tiers : polices exceptées, à vendre localement
  avant mise en production intranet (voir « Durcissement » ci-dessous).
- Interface responsive poste de travail / terminaux mobiles internes (§ V.1).
- Classe de requête affichée (passage unique / multi-hop) et étapes du pipeline
  agentique nommées pendant la génération : HyDE, recherche hybride, fusion RRF,
  reranking, parcours GraphRAG, rédaction, contrôle de fidélité.
- Cycle de vie documentaire : un document remplacé (`superseded`) est signalé dans la
  bibliothèque et sur toute citation qui s'y appuie.
- Quatre métriques RAGAS par réponse (fidélité, pertinence, précision et rappel du
  contexte), affichées avec leurs seuils de production. Un rappel du contexte sous le
  seuil déclenche un avertissement explicite : la réponse peut être fidèle au contexte
  reçu tout en restant incomplète.
- Refus calibré portant le libellé canonique du dossier technique, accompagné des
  références des passages les plus proches du corpus — jamais du texte écarté.
- Avertissement de complexité quand le modèle de raisonnement était indisponible et que
  la réponse a été produite par le modèle léger.
- Vérification secondaire des requêtes critiques ; la trace de raisonnement n'est
  affichée qu'aux administrateurs (la restriction doit aussi être appliquée côté serveur).
- Journal de suivi qualité sur l'écran d'indicateurs : évaluations du golden dataset,
  écart RAGAS / ARES, statut de révision.
- Guide d'utilisation (formulation des questions, limites du système) accessible depuis
  la barre haute.
- Mode hors-ligne : indicateur explicite quand l'intranet est injoignable, questions
  mises en file d'attente et rejouées à la reconnexion. Progressive Web App installable
  (`public/manifest.webmanifest`) ; le service worker ne met en cache que la coquille
  applicative — aucune donnée d'API, aucun extrait de corpus, aucun journal.
- Interface vocale : dictée de la question et lecture de la réponse. La reconnaissance
  (Whisper large-v3) et la synthèse (Coqui TTS) sont **des appels au backend** — le
  navigateur ne fait que capturer le micro et jouer l'audio, aucune API vocale externe.
  `VITE_VOICE_ENABLED=false` retire entièrement micro et lecture.

## Durcissement avant mise en production intranet

1. **Vendoriser la police Archivo** — `index.html` charge actuellement Google Fonts.
   En intranet fermé, télécharger les `woff2` dans `public/fonts/` et remplacer le
   `<link>` par une règle `@font-face` locale. Aucun autre appel sortant n'existe.
2. Servir le build (`npm run build` → `dist/`) derrière le même reverse-proxy TLS 1.3
   que l'API, en même origine, et privilégier `VITE_AUTH_TRANSPORT=cookie`.
3. Ajouter une CSP stricte au niveau du serveur web
   (`default-src 'self'; connect-src 'self'; img-src 'self' data:`).
4. Vérifier qu'aucune source map n'est publiée (`build.sourcemap: false` est le défaut Vite).
5. **Fournir les icônes PWA** — `public/icons/icon-192.png`, `icon-512.png` et
   `icon-maskable-512.png` sont référencées par le manifeste mais ne sont pas incluses :
   déposez-y le logo CAMRAIL aux dimensions demandées. Sans elles, l'application reste
   fonctionnelle mais n'est pas installable proprement.
6. Le service worker n'est enregistré qu'en production (`npm run build`), jamais en
   développement, pour éviter de servir une coquille périmée pendant l'intégration.
