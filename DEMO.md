# Branche `demo` : KALATI, assistant documentaire RAG

Cette branche contient la version de démonstration publiée sur https://mko-kalati.vercel.app.
Toutes les données sont fictives et aucun appel ne part vers un backend : le moteur RAG est
simulé dans le navigateur. **Simulation pédagogique, ce n'est pas le moteur entraîné ni déployé.**

## Ce qui diffère de `master`

- `public/demo/mock-api.js`, injecté en tête de `index.html` uniquement par `npm run build:demo`
  (plugin `kalati-demo-mock` de `vite.config.ts`), intercepte fetch, XMLHttpRequest, WebSocket,
  EventSource et sendBeacon, et sert le contrat de `API_CONTRACT.md`, y compris le flux SSE de
  `POST /api/chat/ask`. Il affiche le bandeau « Démo · données simulées · moteur RAG simulé ».
- Ce que la simulation reproduit :
  - filtrage RBAC (grade minimal et catégories autorisées) appliqué avant la recherche ;
  - recherche hybride BM25 + similarité de trigrammes, fusion RRF (k = 60), reclassement ;
  - classification `single_hop` / `multi_hop` portée de `classify_query()` du moteur Python ;
  - refus calibrés : `out_of_scope`, `low_confidence` (seuil 0,60), `not_authorised`
    (sans divulguer le document), gate de fidélité 0,90 ;
  - réponse extractive : chaque phrase est recopiée d'un passage cité, la fidélité affichée est
    la part des phrases retrouvées mot pour mot dans les sources ;
  - vérification critique simulée sur les instructions de sécurité (trace visible par l'admin) ;
  - journal d'audit chaîné SHA-256, réellement recalculé par « Vérifier l'intégrité ».
- Indicateurs : recalculés sur le journal simulé ; aucune moyenne RAGAS ni évaluation du
  golden dataset n'est affichée (il n'existe pas de mesure réelle à montrer). Les latences du
  journal pré-rempli sont tirées dans le budget de conception (4-5 s / 14-15 s), celles des
  questions posées en direct sont la durée réelle de la simulation.
- Comptes fictifs proposés sur l'écran de connexion (AG-01001 agent, AU-02002 auditeur,
  AD-03003 administrateur), tout mot de passe est accepté.
- Nom et logo de l'exploitant retirés des libellés (logo KALATI conservé), e-mail de support
  remplacé par `support@exemple.org`, interface vocale désactivée (`VITE_VOICE_ENABLED=false`),
  service worker non enregistré en mode démo.

## Construire

```bash
npm ci
npm run build:demo   # sortie : dist/
```

Branche de référence du code : `master`. Cette branche n'est pas destinée à y être fusionnée.
