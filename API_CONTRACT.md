# KALATI — Contrat d'API consommé par le frontend React

Version 1.0 — 13 août 2026. Document de référence pour l'équipe backend .NET.

Le frontend ne connaît **que** cette API. Le service Python / FastAPI n'est jamais
appelé directement par le navigateur (cahier des charges § V.3).

## Conventions générales

- Base : `/api` (préfixe configurable via `VITE_API_URL`).
- Encodage : `application/json; charset=utf-8`, sauf téléversement (`multipart/form-data`).
- Horodatages : ISO 8601 UTC (`2026-08-13T09:41:22Z`).
- Langue de réponse : en-tête `Accept-Language: fr | en` envoyé par le frontend.
- Pagination : paramètres `page` (1-based) et `pageSize`; enveloppe de réponse :

```json
{ "items": [], "page": 1, "pageSize": 20, "total": 137 }
```

### Authentification

Deux transports, au choix du déploiement :

| Transport | Requête frontend | Attendu du backend |
| --- | --- | --- |
| `header` | `Authorization: Bearer <jwt>` | renvoie `accessToken` dans le corps de `/auth/login` |
| `cookie` | `credentials: 'include'` | pose `kalati_at` en `httpOnly; Secure; SameSite=Strict` |

JWT signé **ES256** (ECDSA P-256), validité 8 h, `jti` unique et révocable (§ IV.4).

Claims attendus (le frontend lit uniquement ce que renvoie `/auth/me`, pas le token) :

```json
{
  "sub": "AG-04412",
  "jti": "b2f1…",
  "grade": 6,
  "department": "MAINTENANCE",
  "roles": ["AGENT"],
  "categories": ["MAINTENANCE", "TRANSPORT"],
  "exp": 1786680000
}
```

### Erreurs

Format unique :

```json
{ "code": "RBAC_FORBIDDEN", "message": "Grade insuffisant pour cette catégorie.", "traceId": "…" }
```

| Statut | Signification côté interface |
| --- | --- |
| 400 | Requête invalide — message affiché dans le formulaire |
| 401 | Non authentifié — purge de la session et redirection `/login` |
| 403 | RBAC — écran « accès refusé », l'action est masquée ensuite |
| 404 | Ressource inexistante |
| 409 | Conflit (ex. matricule déjà utilisé) |
| 422 | Validation métier détaillée (`fieldErrors`) |
| 429 | Débit dépassé — le composer se verrouille avec compte à rebours |
| 503 | Service RAG indisponible — bannière dégradée, historique consultable |

---

## 1. Authentification — `/api/auth`

### `POST /api/auth/login`

```json
{ "matricule": "AG-04412", "password": "…" }
```

→ `200`

```json
{
  "accessToken": "eyJhbGciOiJFUzI1NiIs…",
  "expiresAt": "2026-08-13T17:41:22Z",
  "user": {
    "id": "AG-04412",
    "matricule": "AG-04412",
    "fullName": "Nkodo Étienne",
    "grade": 6,
    "gradeLabel": "Agent de maîtrise",
    "department": "MAINTENANCE",
    "departmentLabel": "Maintenance ferroviaire",
    "roles": ["AGENT"],
    "allowedCategories": ["MAINTENANCE", "TRANSPORT"],
    "locale": "fr",
    "transparencyAccepted": false
  }
}
```

Mot de passe haché **Argon2id** (m=64 MiB, t=3, p=4) côté serveur (§ IV.2).

### `GET /api/auth/me`

→ `200` le même objet `user`. Utilisé au démarrage pour restaurer la session.

### `POST /api/auth/logout`

→ `204`. Révoque le `jti` dans Redis et efface le cookie si transport cookie.

### `POST /api/auth/transparency-ack`

→ `204`. Marque l'acceptation de la notice de transparence IA (§ IV.3).

### `PATCH /api/auth/me/preferences`

```json
{ "locale": "en", "defaultScopes": ["MAINTENANCE"] }
```

→ `200` objet `user` mis à jour.

---

## 2. Conversations — `/api/conversations`

### `GET /api/conversations?page=1&pageSize=20&search=`

→ `200` enveloppe paginée d'objets :

```json
{
  "id": "cv_01J8…",
  "title": "Révision roulement boîtes d'essieux",
  "createdAt": "2026-08-12T08:12:00Z",
  "updatedAt": "2026-08-12T08:19:41Z",
  "messageCount": 6,
  "scopes": ["MAINTENANCE"]
}
```

### `POST /api/conversations`

```json
{ "title": null, "scopes": ["MAINTENANCE"] }
```

→ `201` objet conversation. `title` nul : le backend le dérive de la première question.

### `GET /api/conversations/{id}`

→ `200`

```json
{
  "id": "cv_01J8…",
  "title": "…",
  "scopes": ["MAINTENANCE"],
  "messages": [
    { "id": "ms_1", "role": "user", "content": "Comment révise-t-on un roulement de boîtes d'essieux ?", "createdAt": "…" },
    {
      "id": "ms_2",
      "role": "assistant",
      "content": "La révision d'un roulement…",
      "createdAt": "…",
      "model": { "id": "qwen3-14b", "label": "Qwen3-14B", "tier": "light" },
      "faithfulness": 0.94,
      "confidence": 0.78,
      "latencyMs": 4180,
      "iterations": 1,
      "refusal": null,
      "citations": [
        {
          "id": "ct_1",
          "documentId": "doc_7781",
          "documentTitle": "Mode opératoire MO-ESS-014",
          "section": "4. Contrôle du roulement",
          "article": "Art. 4.2",
          "page": 12,
          "excerpt": "Le roulement est déposé après…",
          "score": 0.81,
          "category": "MAINTENANCE",
          "chunkType": "long",
          "superseded": false
        }
      ]
    }
  ]
}
```

`tier` vaut `light` (Qwen3-14B non-thinking) ou `reasoning` (Qwen3-30B-A3B thinking).

### `PATCH /api/conversations/{id}` — `{ "title": "…" }` → `200`

### `DELETE /api/conversations/{id}` → `204`

---

## 3. Génération — `/api/chat`

### `POST /api/chat/ask`

En-tête `Accept: text/event-stream`.

```json
{
  "conversationId": "cv_01J8…",
  "question": "Comment cantonner un train ?",
  "scopes": ["TRANSPORT"]
}
```

→ `200 text/event-stream`. Séquence d'événements SSE (`data:` JSON, un par ligne) :

| `type` | Charge utile | Effet interface |
| --- | --- | --- |
| `accepted` | `{ "messageId": "ms_9", "conversationId": "cv_…", "queryClass": "single_hop" \| "multi_hop" }` | insertion du message assistant vide |
| `stage` | `{ "stage": "hyde" \| "retrieval" \| "fusion" \| "rerank" \| "graph" \| "reformulation" \| "generation" \| "validation", "iteration": 1 }` | libellé d'étape sous le message |
| `citations` | `{ "citations": [ … ] }` | affichage des sources avant la fin du texte |
| `token` | `{ "text": "…" }` | affichage progressif |
| `refusal` | `{ "reason": "low_faithfulness" \| "low_confidence" \| "out_of_scope" \| "not_authorised", "faithfulness": 0.71, "message": "…", "nearestSources": [ … ] }` | bloc de refus calibré, texte partiel écarté, références les plus proches affichées |
| `done` | `{ "model": {…}, "queryClass": "multi_hop", "ragas": {…}, "criticalVerification": {…}, "modelFallback": false, "faithfulness": 0.94, "confidence": 0.78, "latencyMs": 4180, "iterations": 1 }` | badges finalisés, panneau qualité, composer déverrouillé |
| `error` | `{ "code": "RAG_UNAVAILABLE", "message": "…" }` | message d'erreur, possibilité de réessayer |

Exemple de flux :

```
data: {"type":"accepted","messageId":"ms_9","conversationId":"cv_01J8"}

data: {"type":"stage","stage":"retrieval","iteration":1}

data: {"type":"citations","citations":[{"id":"ct_1","documentId":"doc_2210", …}]}

data: {"type":"token","text":"Le cantonnement "}

data: {"type":"token","text":"consiste à "}

data: {"type":"done","model":{"id":"qwen3-30b-a3b","label":"Qwen3-30B-A3B","tier":"reasoning"},"faithfulness":0.93,"confidence":0.74,"latencyMs":14210,"iterations":2}
```

`queryClass` reflète l'évaluateur de complexité : `single_hop` (information dans un
seul passage, modèle léger, 4–5 s) ou `multi_hop` (preuves distribuées, parcours
GraphRAG, modèle de raisonnement, 14–15 s). L'interface l'affiche en étiquette à côté
du modèle.

En cas de refus, le message affiché en tête est le libellé canonique du dossier
technique — « Je ne dispose pas d'une réponse suffisamment documentée dans le corpus
KALATI pour cette question. Veuillez consulter directement le service compétent ou vous
référer au portail KALATI. » — suivi de l'explication portée par l'événement. Pour
`reason: "not_authorised"`, l'interface affiche « Cette information n'est pas disponible
dans le corpus KALATI accessible à votre niveau d'habilitation. »

`nearestSources` porte les références des passages les plus proches trouvés dans le
corpus. Le gate de fidélité les accompagne au refus afin d'orienter l'agent vers les
sources pertinentes ; l'interface les affiche comme citations cliquables, sous une
mention rappelant qu'elles ne constituent pas une réponse. Le texte écarté par le gate
ne doit jamais être transmis au frontend.

### Objets portés par `done`

```json
{
  "ragas": {
    "faithfulness": 0.97,
    "answerRelevancy": 0.93,
    "contextPrecision": 0.88,
    "contextRecall": 0.91
  },
  "criticalVerification": {
    "model": "deepseek-r1-distill-qwen-14b",
    "verdict": "confirmed",
    "trace": "…contenu des tokens <think>…"
  },
  "modelFallback": false
}
```

Trois points d'attention côté backend :

- **`ragas`** — les quatre métriques de la réponse. L'interface les affiche avec leurs
  seuils de production (0,90 / 0,85 / 0,80 / 0,80) et avertit explicitement lorsque le
  `contextRecall` passe sous son seuil : une réponse peut être fidèle au contexte reçu
  tout en étant incomplète, cas signalé comme aussi risqué qu'une hallucination.
- **`criticalVerification`** — présent uniquement sur les requêtes classées critiques.
  `trace` (contenu des tokens `<think>` du vérificateur) ne doit être renseigné que
  lorsque l'appelant a le rôle ADMIN ; l'interface ne l'affiche qu'aux administrateurs,
  mais la restriction doit être appliquée côté serveur.
- **`modelFallback: true`** — le modèle de raisonnement était indisponible et la réponse
  a été produite par le modèle léger. L'interface affiche alors un avertissement de
  complexité à l'agent, comme le prévoit le routage dual-modèle.

Le frontend n'invente aucun contenu : si `faithfulness < 0.90` le backend **doit**
émettre `refusal` (§ IV.3). Le seuil est également connu du frontend
(`VITE_FAITHFULNESS_THRESHOLD`) uniquement pour un affichage cohérent, jamais pour décider.

Repli sans SSE : si la réponse est `application/json`, le frontend accepte le même
objet que `messages[]` ci-dessus et l'affiche progressivement côté client.

### `POST /api/chat/messages/{id}/feedback`

```json
{ "verdict": "useful" | "not_useful", "comment": "…" }
```

→ `204`

### `POST /api/chat/stop` — `{ "messageId": "ms_9" }` → `204`

Annule la génération en cours.

---

## 4. Documents — `/api/documents`

### `GET /api/documents?page=&pageSize=&search=&category=&status=`

`status` ∈ `pending | ocr | correction | chunking | embedding | indexed | failed`
(états du pipeline d'ingestion, § V.5).

→ `200` enveloppe paginée :

```json
{
  "id": "doc_7781",
  "title": "Mode opératoire MO-ESS-014",
  "reference": "MO-ESS-014",
  "category": "MAINTENANCE",
  "documentClass": "IGS" | "CONVENTION" | "CIRCULAIRE_RH" | "PROCEDURE" | "BLOCK" | "RAPPORT",
  "department": "MAINTENANCE",
  "gradeMin": 4,
  "pageCount": 48,
  "sourceType": "scan" | "native_pdf",
  "ocrEngine": "paddleocr-vl" | "glm-ocr" | null,
  "stamped": true,
  "status": "indexed",
  "chunkCount": 312,
  "hasTables": true,
  "version": "v3",
  "effectiveDate": "2025-01-01",
  "lifecycle": "active" | "superseded",
  "supersededBy": null,
  "indexedAt": "2026-07-30T11:02:00Z",
  "updatedAt": "2026-07-30T11:02:00Z"
}

`lifecycle` porte le cycle de vie documentaire (`status` / `superseded_by` du payload
Qdrant) : un texte remplacé reste consultable et traçable dans l'historique, mais
l'interface le signale explicitement, dans la bibliothèque comme dans les citations.
`hasTables` indique qu'une extraction structurée (Table Transformer) a produit des
segments de type `cell`.
```

### `GET /api/documents/{id}` → `200` même objet + `ingestion`

```json
{
  "ingestion": {
    "status": "indexed",
    "steps": [
      { "key": "extraction", "label": "Extraction PyMuPDF", "status": "done", "finishedAt": "…" },
      { "key": "ocr", "label": "PaddleOCR-VL 1.6", "status": "done", "finishedAt": "…" },
      { "key": "correction", "label": "Post-correction lexique CAMRAIL", "status": "done", "finishedAt": "…" },
      { "key": "tables", "label": "Extraction des tableaux (TATR)", "status": "done", "finishedAt": "…" },
      { "key": "chunking", "label": "Segmentation parent-child 128 / 512 tokens", "status": "done", "finishedAt": "…" },
      { "key": "embedding", "label": "Qwen3-Embedding-8B", "status": "done", "finishedAt": "…" },
      { "key": "indexing", "label": "Indexation Qdrant", "status": "done", "finishedAt": "…" }
    ],
    "errorMessage": null
  }
}
```

### `GET /api/documents/{id}/pages/{page}`

→ `200`

```json
{ "page": 12, "text": "…", "imageUrl": "/api/documents/doc_7781/pages/12/image" }
```

Alimente la visionneuse ouverte par une citation. `imageUrl` peut être `null`
pour un PDF natif sans rendu.

### `POST /api/documents` — `multipart/form-data` (ADMIN)

Champs : `file`, `title`, `reference`, `category`, `department`, `gradeMin`.
→ `202` objet document au statut `pending`.

### `DELETE /api/documents/{id}` (ADMIN) → `204`

---

## 5. Journal d'audit — `/api/audit` (rôle AUDITEUR)

### `GET /api/audit/entries?page=&pageSize=&from=&to=&agentHash=&model=&outcome=`

→ `200` enveloppe paginée. Questions et réponses **hachées uniquement** (§ IV.2) :

```json
{
  "id": 918823,
  "timestamp": "2026-08-13T09:41:22Z",
  "agentHash": "9f2c…",
  "grade": 6,
  "department": "MAINTENANCE",
  "questionHash": "4ab1…",
  "answerHash": "77de…",
  "rbacFilter": "grade_min<=6 AND department IN (MAINTENANCE,TRANSPORT)",
  "retrievedCount": 24,
  "keptCount": 6,
  "model": "qwen3-14b",
  "confidence": 0.78,
  "faithfulness": 0.94,
  "outcome": "answered" | "refused" | "error",
  "latencyMs": 4180,
  "prevHash": "0a91…",
  "hash": "c33f…"
}
```

### `GET /api/audit/entries/{id}` → `200` entrée complète

### `POST /api/audit/verify`

```json
{ "fromId": 918000, "toId": 918823 }
```

→ `200`

```json
{ "valid": true, "checkedCount": 824, "firstInvalidId": null, "verifiedAt": "…" }
```

Recalcul du chaînage SHA-256 côté serveur ; l'interface affiche le verdict.

### `GET /api/audit/export?from=&to=&format=csv`

→ `200 text/csv` (téléchargement).

---

## 6. Référentiels et administration — `/api/admin` (rôle ADMIN)

### Agents

- `GET /api/admin/agents?page=&pageSize=&search=&department=&grade=` → enveloppe paginée
- `POST /api/admin/agents` → `201`
- `PATCH /api/admin/agents/{id}` → `200`
- `POST /api/admin/agents/{id}/disable` → `204`
- `POST /api/admin/agents/{id}/reset-password` → `204`

Objet agent :

```json
{
  "id": "AG-04412",
  "matricule": "AG-04412",
  "fullName": "Nkodo Étienne",
  "email": "e.nkodo@camrail.cm",
  "grade": 6,
  "department": "MAINTENANCE",
  "roles": ["AGENT"],
  "allowedCategories": ["MAINTENANCE", "TRANSPORT"],
  "enabled": true,
  "lastLoginAt": "2026-08-13T07:55:00Z"
}
```

### Référentiels (lecture + écriture)

- `GET|POST /api/admin/grades` — `{ "level": 6, "label": "Agent de maîtrise" }`
- `GET|POST /api/admin/departments` — `{ "code": "MAINTENANCE", "label": "Maintenance ferroviaire" }`
- `GET|POST /api/admin/categories` — `{ "code": "MAINTENANCE", "label": "…", "gradeMin": 4 }`
- `PATCH|DELETE /api/admin/{grades|departments|categories}/{id}`

### `GET /api/admin/scopes`

Liste publique (tout agent authentifié) des périmètres métier utilisables comme
filtre dans le chat :

```json
[
  { "code": "MAINTENANCE", "label": "Maintenance ferroviaire" },
  { "code": "TRANSPORT", "label": "Transport / Exploitation" },
  { "code": "RH", "label": "Ressources humaines" },
  { "code": "JURIDIQUE", "label": "Juridique" },
  { "code": "FINANCE", "label": "Finance" },
  { "code": "COMMERCIAL", "label": "Commercial" }
]
```

---

## 7. Indicateurs — `/api/metrics`

### `GET /api/metrics/overview?range=7d|30d|90d`

→ `200`

```json
{
  "ragas": {
    "faithfulness": { "value": 0.94, "delta": 0.01 },
    "answerRelevancy": { "value": 0.92, "delta": 0.0 },
    "contextPrecision": { "value": 0.86, "delta": 0.02 },
    "contextRecall": { "value": 0.83, "delta": -0.01 }
  },
  "questions": { "value": 4128, "delta": 0.12 },
  "answerRate": { "value": 0.91, "delta": 0.03 },
  "refusalRate": { "value": 0.09, "delta": -0.02 },
  "avgFaithfulness": { "value": 0.94, "delta": 0.01 },
  "avgConfidence": { "value": 0.72, "delta": 0.0 },
  "avgLatencyMs": { "value": 5210, "delta": -140 },
  "modelSplit": { "light": 0.78, "reasoning": 0.22 },
  "indexedDocuments": { "value": 1842, "delta": 46 },
  "activeAgents": { "value": 214, "delta": 9 }
}
```

`delta` est la variation relative par rapport à la période précédente
(valeur absolue pour `avgLatencyMs` et les compteurs de documents).

### `GET /api/metrics/timeseries?metric=questions|latency|faithfulness&range=30d`

→ `200`

```json
{ "metric": "questions", "unit": "count", "points": [ { "t": "2026-07-15", "v": 128 } ] }
```

### `GET /api/metrics/scopes?range=30d`

→ `200` `[ { "code": "MAINTENANCE", "questions": 1420, "refusalRate": 0.07 } ]`

### `GET /api/metrics/quality-runs?limit=12`

Journal de suivi qualité : évaluations du golden dataset (hebdomadaires, et après chaque
mise à jour du corpus ou du pipeline).

→ `200`

```json
[
  {
    "id": "run_2026_33",
    "runAt": "2026-08-10T02:00:00Z",
    "trigger": "scheduled" | "corpus_update" | "pipeline_update",
    "questionCount": 50,
    "faithfulness": 0.96,
    "answerRelevancy": 0.94,
    "contextPrecision": 0.89,
    "contextRecall": 0.9,
    "aresDivergence": 0.02,
    "status": "passed" | "review_required" | "failed"
  }
]
```

`aresDivergence` est l'écart absolu maximal entre les métriques RAGAS et les estimations
ARES sur le sous-ensemble annoté. Au-delà de 0,05, le statut passe à `review_required`.

---

## 8. Interface vocale — `/api/voice`

Reconnaissance et synthèse restent **côté serveur** (Whisper large-v3, Coqui TTS) :
le navigateur ne fait que capturer le micro et jouer l'audio, ce qui préserve le
confinement intranet. Aucune API vocale du navigateur ni service externe n'est employé.

### `POST /api/voice/transcribe`

`multipart/form-data` — champs `audio` (`audio/webm`, enregistrement MediaRecorder) et
`language` (`fr` | `en`).

→ `200`

```json
{ "text": "Comment cantonner un train ?", "durationMs": 3120, "corrected": true }
```

`corrected` indique que la post-correction par le lexique ferroviaire CAMRAIL a été
appliquée. Le frontend n'utilise que `text`, inséré dans le champ de saisie —
l'agent relit et valide avant envoi ; aucune question n'est envoyée automatiquement.

### `GET /api/voice/speak/{messageId}`

→ `200 audio/mpeg` (ou `audio/wav`) — lecture de la réponse déjà générée et validée.
Une réponse refusée ne doit pas être synthétisée : renvoyer `409`.

Budget de latence attendu (dossier technique, Phase 6) : 6–10 s pour une requête
simple, 16–20 s pour une requête multi-hop, ASR et TTS inclus.

---

## 9. Santé — `/api/health`

→ `200`

```json
{
  "status": "ok" | "degraded",
  "components": {
    "dotnet": "ok",
    "fastapi": "ok",
    "postgres": "ok",
    "qdrant": "ok",
    "redis": "ok",
    "vault": "ok"
  }
}
```

Interrogé toutes les 60 s ; `degraded` affiche une bannière d'information.

---

## Récapitulatif des endpoints

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
POST   /api/auth/transparency-ack
PATCH  /api/auth/me/preferences

GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/{id}
PATCH  /api/conversations/{id}
DELETE /api/conversations/{id}

POST   /api/chat/ask                    (SSE)
POST   /api/chat/stop
POST   /api/chat/messages/{id}/feedback

GET    /api/documents
GET    /api/documents/{id}
GET    /api/documents/{id}/pages/{page}
POST   /api/documents                   (ADMIN, multipart)
DELETE /api/documents/{id}              (ADMIN)

GET    /api/audit/entries
GET    /api/audit/entries/{id}
POST   /api/audit/verify
GET    /api/audit/export

GET    /api/admin/scopes
GET    /api/admin/agents
POST   /api/admin/agents
PATCH  /api/admin/agents/{id}
POST   /api/admin/agents/{id}/disable
POST   /api/admin/agents/{id}/reset-password
GET    /api/admin/grades
POST   /api/admin/grades
GET    /api/admin/departments
POST   /api/admin/departments
GET    /api/admin/categories
POST   /api/admin/categories

GET    /api/metrics/overview
GET    /api/metrics/timeseries
GET    /api/metrics/scopes
GET    /api/metrics/quality-runs

POST   /api/voice/transcribe            (multipart audio)
GET    /api/voice/speak/{messageId}

GET    /api/health
```
