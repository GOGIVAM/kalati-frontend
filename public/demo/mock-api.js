/*!
 * KALATI (assistant documentaire RAG) : API de démonstration, données simulées.
 * Chargé AVANT le bundle (uniquement dans le build `--mode demo`).
 * Intercepte fetch, XMLHttpRequest, WebSocket, EventSource et sendBeacon :
 * aucune requête ne part vers un backend ; les appels /api/... sont servis ici.
 *
 * Simulation pédagogique, ce n'est pas le moteur RAG réel (Qdrant, Qwen3,
 * reranker, GraphRAG ne tournent pas dans le navigateur). Ce qui est reproduit :
 *  - filtrage RBAC (grade_min <= grade ET catégorie autorisée) AVANT le calcul
 *    de similarité, comme le filtre Qdrant du moteur ;
 *  - recherche hybride : BM25 (k1 = 1,2 ; b = 0,75) + similarité de trigrammes
 *    de caractères (substitut du dense), fusionnées par RRF (k = 60, RRF_K du moteur) ;
 *  - classification single_hop / multi_hop : portage de classify_query()
 *    (app/services/rag/generator.py) ;
 *  - reclassement : part des termes de la question présents + cosinus de trigrammes ;
 *  - score d'un passage = part des termes significatifs de la question
 *    retrouvés dans le passage ; confiance = moyenne sur les passages retenus,
 *    refus calibré sous 0,60 (CONFIDENCE_THRESHOLD du moteur) ;
 *  - réponse extractive : phrases recopiées des passages cités ; la fidélité
 *    est mesurée en vérifiant que chaque phrase figure mot pour mot dans une
 *    source (gate à 0,90, FAITHFULNESS_THRESHOLD) ;
 *  - journal d'audit chaîné SHA-256, recalculé réellement par /audit/verify.
 * Le corpus, les agents et le journal sont entièrement fictifs.
 */
(function () {
  'use strict';
  if (window.__DEMO_MOCK__) return;

  /* ====================================================================== */
  /* 1. Configuration propre au site                                        */
  /* ====================================================================== */

  var SITE = {
    name: 'kalati',
    badge: 'Démo · données simulées · moteur RAG simulé',
    badgeCss: function () {
      return window.innerWidth < 760
        ? 'right:4px;bottom:2px;white-space:nowrap;transform:scale(.85);transform-origin:right bottom;'
        : 'left:50%;transform:translateX(-50%);top:6px;white-space:nowrap;';
    },
    isApi: function (u) { return /^\/api(\/|$)/.test(u.pathname); },
    fallback: function (ctx) {
      if (ctx.method !== 'GET') return R(204, null);
      return R(404, { code: 'NOT_FOUND', message: 'Ressource absente de la démo.' });
    },
    delay: function () { return 120 + Math.floor(Math.random() * 180); },
    routes: []
  };

  /* ---------- Outils ---------- */

  // PRNG déterministe (mulberry32) : le jeu de données est identique à chaque visite.
  function prng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // SHA-256 synchrone (FIPS 180-4), utilisé pour le chaînage du journal d'audit.
  var SHA_K = [];
  (function () {
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) >>> 0; }
    var n = 2, c = 0;
    while (c < 64) {
      var prime = true;
      for (var f = 2; f * f <= n; f++) if (n % f === 0) { prime = false; break; }
      if (prime) { SHA_K[c++] = frac(Math.pow(n, 1 / 3)); }
      n++;
    }
  })();
  function sha256(str) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(String(str)));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var i = 0; i < bytes.length; i += 64) {
      for (var t = 0; t < 16; t++) W[t] = (bytes[i + 4 * t] << 24) | (bytes[i + 4 * t + 1] << 16) | (bytes[i + 4 * t + 2] << 8) | bytes[i + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + SHA_K[t] + W[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  function iso(d) { return new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  var NOW = Date.now();
  var DAY = 86400000;
  function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 10); }
  function page(list, q, defSize) {
    var p = Math.max(1, Number(q.page) || 1), size = Math.max(1, Number(q.pageSize) || defSize || 20);
    return { items: list.slice((p - 1) * size, p * size), page: p, pageSize: size, total: list.length };
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- Référentiels fictifs ---------- */

  var SCOPES = [
    { code: 'MAINTENANCE', label: 'Maintenance ferroviaire' },
    { code: 'TRANSPORT', label: 'Transport / Exploitation' },
    { code: 'RH', label: 'Ressources humaines' },
    { code: 'JURIDIQUE', label: 'Juridique' },
    { code: 'FINANCE', label: 'Finance' },
    { code: 'COMMERCIAL', label: 'Commercial' }
  ];
  var GRADES = [
    { id: 'g1', level: 1, label: 'Agent d\'exécution' },
    { id: 'g3', level: 3, label: 'Agent qualifié' },
    { id: 'g5', level: 5, label: 'Agent technique' },
    { id: 'g6', level: 6, label: 'Agent de maîtrise' },
    { id: 'g8', level: 8, label: 'Cadre' },
    { id: 'g10', level: 10, label: 'Cadre supérieur' }
  ];
  var DEPARTMENTS = [
    { id: 'd1', code: 'MAINTENANCE', label: 'Maintenance ferroviaire' },
    { id: 'd2', code: 'TRANSPORT', label: 'Transport / Exploitation' },
    { id: 'd3', code: 'RH', label: 'Ressources humaines' },
    { id: 'd4', code: 'JURIDIQUE', label: 'Juridique' },
    { id: 'd5', code: 'FINANCE', label: 'Finance' },
    { id: 'd6', code: 'COMMERCIAL', label: 'Commercial' },
    { id: 'd7', code: 'AUDIT', label: 'Audit interne' },
    { id: 'd8', code: 'DSI', label: 'Systèmes d\'information' }
  ];
  var CATEGORIES = [
    { id: 'c1', code: 'MAINTENANCE', label: 'Maintenance ferroviaire', gradeMin: 1 },
    { id: 'c2', code: 'TRANSPORT', label: 'Transport / Exploitation', gradeMin: 1 },
    { id: 'c3', code: 'RH', label: 'Ressources humaines', gradeMin: 1 },
    { id: 'c4', code: 'JURIDIQUE', label: 'Juridique', gradeMin: 8 },
    { id: 'c5', code: 'FINANCE', label: 'Finance', gradeMin: 5 },
    { id: 'c6', code: 'COMMERCIAL', label: 'Commercial', gradeMin: 1 }
  ];
  function gradeLabel(level) {
    var g = GRADES.filter(function (x) { return x.level <= level; }).pop();
    return g ? g.label : 'Agent';
  }
  function deptLabel(code) {
    var d = DEPARTMENTS.filter(function (x) { return x.code === code; })[0];
    return d ? d.label : code;
  }

  // Comptes de démonstration (noms fictifs). Le mot de passe n'est pas vérifié.
  var DEMO_ACCOUNTS = [
    { matricule: 'AG-01001', fullName: 'Ernest Tchinda', grade: 6, department: 'MAINTENANCE', roles: ['AGENT'], allowedCategories: ['MAINTENANCE', 'TRANSPORT', 'RH', 'COMMERCIAL'] },
    { matricule: 'AU-02002', fullName: 'Clarisse Ngo Bayiha', grade: 8, department: 'AUDIT', roles: ['AGENT', 'AUDITEUR'], allowedCategories: ['MAINTENANCE', 'TRANSPORT', 'RH', 'COMMERCIAL', 'FINANCE'] },
    { matricule: 'AD-03003', fullName: 'Patrick Essomba', grade: 10, department: 'DSI', roles: ['AGENT', 'AUDITEUR', 'ADMIN'], allowedCategories: ['MAINTENANCE', 'TRANSPORT', 'RH', 'JURIDIQUE', 'FINANCE', 'COMMERCIAL'] }
  ];
  var OTHER_AGENTS = [
    ['AG-01107', 'Sylvie Abena', 3, 'TRANSPORT', ['TRANSPORT']],
    ['AG-01188', 'Brice Owona', 5, 'MAINTENANCE', ['MAINTENANCE', 'TRANSPORT']],
    ['AG-01214', 'Aïcha Bouba', 6, 'TRANSPORT', ['TRANSPORT', 'MAINTENANCE']],
    ['AG-01302', 'Joël Kamga', 1, 'MAINTENANCE', ['MAINTENANCE']],
    ['AG-01356', 'Mireille Etoundi', 8, 'RH', ['RH', 'JURIDIQUE']],
    ['AG-01421', 'Fabrice Ndongo', 5, 'COMMERCIAL', ['COMMERCIAL']],
    ['AG-01477', 'Nadège Fotso', 6, 'FINANCE', ['FINANCE', 'COMMERCIAL']],
    ['AG-01530', 'Ibrahim Moussa', 3, 'MAINTENANCE', ['MAINTENANCE']],
    ['AG-01592', 'Laure Mvogo', 10, 'JURIDIQUE', ['JURIDIQUE', 'RH', 'FINANCE']]
  ];
  function mail(name) { return norm(name).replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@exemple.org'; }

  function seedAgents() {
    var rnd = prng(7);
    var list = DEMO_ACCOUNTS.map(function (a) {
      return { id: a.matricule, matricule: a.matricule, fullName: a.fullName, email: mail(a.fullName), grade: a.grade, department: a.department, roles: a.roles.slice(), allowedCategories: a.allowedCategories.slice(), enabled: true, lastLoginAt: iso(NOW - Math.floor(rnd() * 3 * DAY)) };
    });
    OTHER_AGENTS.forEach(function (o, i) {
      list.push({ id: o[0], matricule: o[0], fullName: o[1], email: mail(o[1]), grade: o[2], department: o[3], roles: ['AGENT'], allowedCategories: o[4], enabled: i !== 3, lastLoginAt: iso(NOW - Math.floor((1 + rnd() * 20) * DAY)) });
    });
    return list;
  }
  function agents() { var a = S.get('agents'); if (!a) { a = seedAgents(); S.set('agents', a); } return a; }

  /* ---------- Corpus fictif ---------- */
  // Chaque passage : [page, section, article, texte, chunkType]. Rédigé pour la démo ; aucun texte réel.
  var FICTIF = 'Document fictif rédigé pour la démonstration. ';
  var DOCS = [
    {
      id: 'doc_mo_ess_014', title: 'Mode opératoire MO-ESS-014 · Révision des boîtes d\'essieux', reference: 'MO-ESS-014',
      category: 'MAINTENANCE', documentClass: 'PROCEDURE', department: 'MAINTENANCE', gradeMin: 4, pageCount: 18,
      sourceType: 'scan', ocrEngine: 'paddleocr-vl', stamped: true, status: 'indexed', hasTables: true,
      version: 'v3', effectiveDate: '2025-01-01', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 40 * DAY,
      passages: [
        [4, '2. Périmètre', 'Art. 2.1', 'Le présent mode opératoire s\'applique à la révision des boîtes d\'essieux à roulements des voitures et des wagons. La révision est exécutée à chaque visite de niveau 3 ou après tout échauffement signalé par un détecteur de boîtes chaudes.', 'long'],
        [12, '4. Contrôle du roulement', 'Art. 4.2', 'La révision d\'un roulement de boîte d\'essieu se déroule en quatre temps : dépose du couvercle et purge de la graisse usagée, nettoyage du roulement au solvant agréé, contrôle visuel des pistes et des rouleaux, puis mesure du jeu radial. Tout roulement présentant un écaillage, de la corrosion ou une trace de surchauffe est rebuté.', 'long'],
        [13, '4. Contrôle du roulement', 'Art. 4.3', 'Le jeu radial mesuré doit rester dans les limites du tableau T4. Au-delà de la valeur maximale admissible en service, le roulement est remplacé et l\'essieu est inscrit « à suivre » dans le registre de l\'atelier.', 'short'],
        [14, '5. Remontage', 'Art. 5.1', 'Au remontage, la boîte d\'essieu est regarnie avec la quantité de graisse prescrite, le couvercle est serré au couple indiqué, puis la date de révision est poinçonnée sur la plaque de boîte.', 'short'],
        [16, 'Annexe · Tableau T4', 'Tableau T4', 'Tableau T4, jeu radial admissible du roulement : à neuf de 0,10 à 0,18 mm ; en service jusqu\'à 0,30 mm ; rebut au-delà de 0,30 mm.', 'cell']
      ]
    },
    {
      id: 'doc_mo_ess_014_v2', title: 'Mode opératoire MO-ESS-014 · Révision des boîtes d\'essieux (v2)', reference: 'MO-ESS-014',
      category: 'MAINTENANCE', documentClass: 'PROCEDURE', department: 'MAINTENANCE', gradeMin: 4, pageCount: 15,
      sourceType: 'scan', ocrEngine: 'paddleocr-vl', stamped: true, status: 'indexed', hasTables: false,
      version: 'v2', effectiveDate: '2021-06-01', lifecycle: 'superseded', supersededBy: 'doc_mo_ess_014', indexedAt: NOW - 200 * DAY,
      passages: [
        [11, '4. Contrôle du roulement', 'Art. 4.2', 'Version antérieure : la révision du roulement comportait trois temps, sans mesure systématique du jeu radial.', 'long']
      ]
    },
    {
      id: 'doc_igs_03', title: 'Instruction IGS-03 · Cantonnement et circulation sur voie unique', reference: 'IGS-03',
      category: 'TRANSPORT', documentClass: 'IGS', department: 'TRANSPORT', gradeMin: 3, pageCount: 24,
      sourceType: 'native_pdf', ocrEngine: null, stamped: false, status: 'indexed', hasTables: false,
      version: 'v5', effectiveDate: '2024-03-15', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 25 * DAY, critical: true,
      passages: [
        [6, '3. Principe du cantonnement', 'Art. 3.1', 'Le cantonnement consiste à diviser la ligne en cantons dans lesquels un seul train est admis à la fois. Sur voie unique, le canton est attribué à un train par le régulateur, qui en délivre l\'autorisation au chef de gare de départ.', 'long'],
        [7, '3. Principe du cantonnement', 'Art. 3.2', 'Pour cantonner un train, le chef de gare demande la voie libre à la gare suivante, consigne la dépêche reçue dans le registre des dépêches, puis remet au conducteur l\'autorisation de circuler. Aucun train ne peut être expédié tant que la dépêche de voie libre n\'a pas été reçue.', 'short'],
        [8, '3. Principe du cantonnement', 'Art. 3.4', 'Lorsque le train a franchi intégralement le canton, la gare d\'arrivée annonce l\'arrivée du train complet, signal de queue constaté. Le canton n\'est libéré qu\'à réception de cette annonce.', 'short'],
        [11, '5. Incidents de circulation', 'Art. 5.2', 'En cas de déraillement, le canton reste occupé jusqu\'à la restitution de la voie par le responsable de l\'intervention. Aucune circulation n\'est autorisée dans les deux sens tant que la voie n\'est pas restituée.', 'long']
      ]
    },
    {
      id: 'doc_igs_07', title: 'Instruction IGS-07 · Essais de freins des trains', reference: 'IGS-07',
      category: 'TRANSPORT', documentClass: 'IGS', department: 'TRANSPORT', gradeMin: 3, pageCount: 16,
      sourceType: 'native_pdf', ocrEngine: null, stamped: false, status: 'indexed', hasTables: false,
      version: 'v2', effectiveDate: '2023-09-01', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 60 * DAY, critical: true,
      passages: [
        [5, '2. Essai complet', 'Art. 2.1', 'Avant tout départ d\'un train formé ou modifié, un essai complet des freins est réalisé : serrage, vérification du serrage sur chaque véhicule, desserrage, puis vérification du desserrage. L\'agent qui réalise l\'essai remet au conducteur le bulletin d\'essai de freins signé.', 'long'],
        [6, '3. Essai partiel', 'Art. 3.1', 'Un essai partiel des freins suffit après adjonction ou retrait de véhicules en queue du train. Il porte sur la continuité de la conduite générale jusqu\'au dernier véhicule.', 'short']
      ]
    },
    {
      id: 'doc_circ_rh_12', title: 'Circulaire RH-2025-12 · Procédure disciplinaire', reference: 'RH-2025-12',
      category: 'RH', documentClass: 'CIRCULAIRE_RH', department: 'RH', gradeMin: 5, pageCount: 6,
      sourceType: 'scan', ocrEngine: 'glm-ocr', stamped: true, status: 'indexed', hasTables: false,
      version: 'v1', effectiveDate: '2025-03-01', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 30 * DAY,
      passages: [
        [1, 'Objet', 'Art. 1', 'La présente circulaire fixe la procédure disciplinaire applicable au personnel ; elle est en vigueur depuis le 1er mars 2025.', 'short'],
        [2, 'Engagement de la procédure', 'Art. 2', 'La procédure disciplinaire débute par une demande d\'explication écrite adressée à l\'agent, qui dispose de soixante-douze heures pour répondre.', 'short'],
        [3, 'Sanctions', 'Art. 3', 'Au vu de la réponse, le supérieur hiérarchique peut proposer une sanction du premier degré, avertissement ou blâme, ou saisir le conseil de discipline pour une sanction du second degré.', 'long'],
        [4, 'Conseil de discipline', 'Art. 5', 'Le conseil de discipline entend l\'agent, qui peut se faire assister d\'un collègue de son choix. La décision motivée lui est notifiée par écrit.', 'long']
      ]
    },
    {
      id: 'doc_conv_coll', title: 'Convention collective d\'entreprise · extraits', reference: 'CONV-COLL',
      category: 'RH', documentClass: 'CONVENTION', department: 'RH', gradeMin: 1, pageCount: 64,
      sourceType: 'native_pdf', ocrEngine: null, stamped: false, status: 'indexed', hasTables: true,
      version: 'v4', effectiveDate: '2022-01-01', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 90 * DAY,
      passages: [
        [18, 'Titre III · Congés', 'Article 22', 'Tout agent acquiert deux jours et demi ouvrables de congé payé par mois de service effectif. Le congé est pris par fraction d\'au moins douze jours consécutifs.', 'short'],
        [31, 'Titre IV · Durée du travail', 'Article 48', 'La durée hebdomadaire de travail est fixée à quarante heures. Les heures effectuées au-delà sont majorées selon le barème de l\'annexe 3.', 'short']
      ]
    },
    {
      id: 'doc_concession', title: 'Contrat de concession · note de synthèse juridique', reference: 'JUR-CONC-01',
      category: 'JURIDIQUE', documentClass: 'CONVENTION', department: 'JURIDIQUE', gradeMin: 9, pageCount: 12,
      sourceType: 'native_pdf', ocrEngine: null, stamped: false, status: 'indexed', hasTables: false,
      version: 'v1', effectiveDate: '2024-07-01', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 75 * DAY,
      passages: [
        [3, '2. Durée', 'Art. 2', 'Le contrat de concession ferroviaire court sur une durée initiale de trente ans à compter de sa date d\'effet ; son échéance peut être prorogée par avenant après la clause de revoyure prévue à mi-parcours.', 'long']
      ]
    },
    {
      id: 'doc_cgt', title: 'Conditions générales de transport des marchandises', reference: 'COM-CGT-02',
      category: 'COMMERCIAL', documentClass: 'PROCEDURE', department: 'COMMERCIAL', gradeMin: 1, pageCount: 20,
      sourceType: 'native_pdf', ocrEngine: null, stamped: false, status: 'indexed', hasTables: false,
      version: 'v2', effectiveDate: '2025-02-01', lifecycle: 'active', supersededBy: null, indexedAt: NOW - 50 * DAY,
      passages: [
        [2, '1. Objet', 'Art. 1', 'Les conditions générales de transport des marchandises s\'appliquent à toute expédition confiée au transporteur. Toute expédition fait l\'objet d\'une lettre de voiture établie par l\'expéditeur.', 'long'],
        [9, '6. Réclamations', 'Art. 6.2', 'La réclamation pour avarie ou manquant doit être présentée par écrit dans un délai de sept jours après la livraison, accompagnée de la lettre de voiture.', 'short']
      ]
    },
    {
      id: 'doc_ret_2024_031', title: 'Rapport d\'enquête technique RET-2024-031', reference: 'RET-2024-031',
      category: 'MAINTENANCE', documentClass: 'RAPPORT', department: 'MAINTENANCE', gradeMin: 6, pageCount: 32,
      sourceType: 'scan', ocrEngine: 'paddleocr-vl', stamped: true, status: 'embedding', hasTables: true,
      version: 'v1', effectiveDate: '2024-11-20', lifecycle: 'active', supersededBy: null, indexedAt: null,
      passages: []
    },
    {
      id: 'doc_ns_epi', title: 'Note de service · Port des équipements de protection', reference: 'NS-2025-07',
      category: 'MAINTENANCE', documentClass: 'PROCEDURE', department: 'MAINTENANCE', gradeMin: 1, pageCount: 4,
      sourceType: 'scan', ocrEngine: 'glm-ocr', stamped: true, status: 'failed', hasTables: false,
      version: 'v1', effectiveDate: '2025-05-12', lifecycle: 'active', supersededBy: null, indexedAt: null,
      errorMessage: 'Page 3 : confiance OCR 0,52, sous le seuil de 0,70. Rescan demandé.',
      passages: []
    }
  ];
  var DOC_BY_ID = {};
  DOCS.forEach(function (d) { DOC_BY_ID[d.id] = d; });

  /* ---------- Recherche hybride simulée ---------- */

  var STOP = ('a au aux avec ce ces cet cette comment dans de des du elle en est et etre il ils je la le les leur lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que quel quelle quelles quels qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y l d s t c n j m qu est-ce faut faire peut doit sont ont avoir quoi combien quand tout tous toute toutes ainsi').split(' ');
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  function stems(text) {
    return norm(text).split(/[^a-z0-9]+/).filter(function (w) { return w && !STOPSET[w] && (w.length > 2 || /\d/.test(w)); })
      .map(function (w) { w = w.replace(/(x|s)$/, ''); return w.length > 5 ? w.slice(0, 5) : w; });
  }
  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function trigrams(text) {
    var s = ' ' + norm(text).replace(/[^a-z0-9]+/g, ' ').trim() + ' ', m = {};
    for (var i = 0; i < s.length - 2; i++) { var g = s.substr(i, 3); m[g] = (m[g] || 0) + 1; }
    return m;
  }
  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0, k;
    for (k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
    for (k in b) nb += b[k] * b[k];
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  // Index : un passage = un segment (titre du document inclus comme métadonnée).
  var PASSAGES = [];
  DOCS.forEach(function (d) {
    d.passages.forEach(function (p, i) {
      var text = p[3];
      var toks = stems(d.title + ' ' + text);
      PASSAGES.push({ id: d.id + '#' + i, doc: d, page: p[0], section: p[1], article: p[2], text: text, chunkType: p[4], toks: toks, set: uniq(stems(text)), tri: trigrams(text) });
    });
  });
  var AVGDL = PASSAGES.reduce(function (s, p) { return s + p.toks.length; }, 0) / Math.max(1, PASSAGES.length);
  var DF = {};
  PASSAGES.forEach(function (p) { uniq(p.toks).forEach(function (t) { DF[t] = (DF[t] || 0) + 1; }); });
  var VOCAB = DF;

  function searchable(p) { return p.doc.status === 'indexed' && p.doc.lifecycle === 'active'; }
  function allowed(p, user, scopes) {
    if (p.doc.gradeMin > user.grade) return false;
    if (user.allowedCategories.indexOf(p.doc.category) < 0) return false;
    if (scopes && scopes.length && scopes.indexOf(p.doc.category) < 0) return false;
    return true;
  }
  function bm25(qt, p) {
    var N = PASSAGES.length, s = 0, tf = {};
    p.toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
    qt.forEach(function (t) {
      if (!tf[t]) return;
      var idf = Math.log(1 + (N - DF[t] + 0.5) / (DF[t] + 0.5));
      s += idf * (tf[t] * 2.2) / (tf[t] + 1.2 * (1 - 0.75 + 0.75 * p.toks.length / AVGDL));
    });
    return s;
  }
  // Recherche hybride sur un ensemble DÉJÀ filtré par le RBAC.
  function hybrid(question, pool) {
    var qt = uniq(stems(question)), qtri = trigrams(question);
    var lex = pool.map(function (p) { return { p: p, s: bm25(qt, p) }; }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    var den = pool.map(function (p) { return { p: p, s: cosine(qtri, p.tri) }; }).sort(function (a, b) { return b.s - a.s; });
    var rrf = {};
    lex.forEach(function (x, i) { rrf[x.p.id] = (rrf[x.p.id] || 0) + 1 / (60 + i + 1); });
    den.slice(0, 20).forEach(function (x, i) { rrf[x.p.id] = (rrf[x.p.id] || 0) + 1 / (60 + i + 1); });
    return pool.filter(function (p) { return rrf[p.id]; }).map(function (p) {
      var hit = qt.filter(function (t) { return p.set.indexOf(t) >= 0; }).length;
      return { p: p, rrf: rrf[p.id], coverage: qt.length ? hit / qt.length : 0, rerank: (qt.length ? hit / qt.length : 0) + cosine(qtri, p.tri) };
    }).sort(function (a, b) { return b.rerank - a.rerank || b.rrf - a.rrf; });
  }

  // Portage de classify_query() (generator.py) ; les mots-clés sont cherchés en mots entiers.
  function classifyQuery(question) {
    var q = norm(question);
    var kws = ['et', 'croiser', 'combiner', 'a la fois', 'en meme temps', 'comparer', 'difference entre', 'quelles sont toutes', 'liste complete'];
    var pats = [/\barticle\s+\d+/, /\bigs\b/, /\bconvention\s+collective/, /\bprocedure\b/, /\bnote\s+de\s+service\b/, /\bcirculaire\b/, /\bainsi\s+que\b/];
    if (kws.some(function (k) { return new RegExp('(^|[^a-z])' + k + '([^a-z]|$)').test(q); })) return 'multi_hop';
    if (pats.some(function (r) { return r.test(q); })) return 'multi_hop';
    if (question.length > 200) return 'multi_hop';
    return 'single_hop';
  }

  var MODELS = {
    light: { id: 'qwen3-14b', label: 'Qwen3-14B', tier: 'light' },
    reasoning: { id: 'qwen3-30b-a3b', label: 'Qwen3-30B-A3B', tier: 'reasoning' }
  };
  var CONF_T = 0.60, FAITH_T = 0.90;

  function citation(x, i) {
    return {
      id: 'ct_' + (i + 1), documentId: x.p.doc.id, documentTitle: x.p.doc.title, section: x.p.section, article: x.p.article,
      page: x.p.page, excerpt: x.p.text, score: Math.round(x.coverage * 100) / 100, category: x.p.doc.category,
      chunkType: x.p.chunkType, superseded: x.p.doc.lifecycle === 'superseded'
    };
  }
  function sentences(text) { return text.split(/(?<=\.)\s+/).map(function (s) { return s.trim(); }).filter(Boolean); }

  /** Pipeline complet, synchrone. Renvoie la réponse et la trace des étapes. */
  function answer(question, user, scopes) {
    var qclass = classifyQuery(question);
    var qt = uniq(stems(question));
    var known = qt.filter(function (t) { return VOCAB[t]; });
    var pool = PASSAGES.filter(searchable);
    var granted = pool.filter(function (p) { return allowed(p, user, scopes); });
    var ranked = hybrid(question, granted);
    var kept = ranked.filter(function (x) { return x.coverage >= 0.5; }).slice(0, 3);
    var confidence = kept.length ? kept.reduce(function (s, x) { return s + x.coverage; }, 0) / kept.length : (ranked[0] ? ranked[0].coverage : 0);
    confidence = Math.round(confidence * 100) / 100;
    var out = { queryClass: qclass, retrievedCount: ranked.length, keptCount: kept.length, confidence: confidence, model: qclass === 'multi_hop' ? MODELS.reasoning : MODELS.light };
    var rbac = 'grade_min<=' + user.grade + ' AND category IN (' + (scopes && scopes.length ? scopes.filter(function (s) { return user.allowedCategories.indexOf(s) >= 0; }) : user.allowedCategories).join(',') + ')';
    out.rbacFilter = rbac;

    if (!known.length) {
      out.refusal = { reason: 'out_of_scope', confidence: 0, message: 'Aucun terme de la question ne figure dans le corpus indexé.', nearestSources: [] };
      return out;
    }
    if (!kept.length || confidence < CONF_T) {
      // Le passage pertinent existe-t-il hors des droits de l'agent ? On ne dit pas lequel.
      var hidden = hybrid(question, pool.filter(function (p) { return !allowed(p, user, scopes); }))[0];
      if (hidden && hidden.coverage >= 0.6) {
        out.refusal = { reason: 'not_authorised', confidence: confidence, message: null, nearestSources: [] };
        return out;
      }
      out.refusal = {
        reason: 'low_confidence', confidence: confidence,
        message: 'Confiance de récupération ' + String(confidence.toFixed(2)).replace('.', ',') + ', sous le seuil de 0,60.',
        nearestSources: ranked.filter(function (x) { return x.coverage > 0; }).slice(0, 2).map(citation)
      };
      return out;
    }

    // Génération extractive : phrases des passages retenus qui contiennent des termes de la question.
    var parts = [], claims = [];
    kept.forEach(function (x, i) {
      var ss = sentences(x.p.text).map(function (s) {
        var st = uniq(stems(s));
        return { s: s, hit: qt.filter(function (t) { return st.indexOf(t) >= 0; }).length };
      }).filter(function (o) { return o.hit > 0; });
      if (i > 0) ss = ss.sort(function (a, b) { return b.hit - a.hit; }).slice(0, 1);
      else ss = ss.slice(0, 2);
      if (!ss.length) return;
      var lead = (i === 0 ? 'D\'après ' : 'Le document ') + x.p.doc.reference + ' (' + x.p.article + ', p. ' + x.p.page + ')' + (i === 0 ? ' : ' : ' précise : ');
      var body = ss.map(function (o) { claims.push(o.s); return o.s; }).join(' ');
      parts.push(lead + body.charAt(0).toLowerCase() + body.slice(1));
    });
    // Contrôle de fidélité : chaque affirmation doit figurer mot pour mot dans une source citée.
    var supported = claims.filter(function (c) { return kept.some(function (x) { return x.p.text.indexOf(c) >= 0; }); }).length;
    out.faithfulness = claims.length ? Math.round(supported / claims.length * 100) / 100 : 0;
    out.citations = kept.map(citation);
    if (out.faithfulness < FAITH_T) {
      out.refusal = { reason: 'low_faithfulness', faithfulness: out.faithfulness, confidence: confidence, message: null, nearestSources: out.citations };
      return out;
    }
    out.content = parts.join('\n\n');
    out.critical = kept.some(function (x) { return x.p.doc.critical; });
    return out;
  }

  function stagesFor(qclass) {
    return qclass === 'multi_hop'
      ? ['hyde', 'retrieval', 'fusion', 'rerank', 'graph', 'generation', 'validation']
      : ['retrieval', 'fusion', 'rerank', 'generation', 'validation'];
  }
  function verification(user) {
    return {
      model: 'deepseek-r1-distill-qwen-14b', verdict: 'confirmed',
      trace: user.roles.indexOf('ADMIN') >= 0
        ? 'Trace simulée (démo) : requête classée critique (procédure de sécurité). Chaque phrase de la réponse a été retrouvée dans un passage cité ; aucune contradiction avec les autres articles retenus. Verdict : confirmé.'
        : null
    };
  }

  /* ---------- Utilisateur courant ---------- */

  function profileOf(a) {
    var prefs = S.get('prefs_' + a.matricule) || {};
    return {
      id: a.matricule, matricule: a.matricule, fullName: a.fullName, email: a.email, grade: a.grade,
      gradeLabel: gradeLabel(a.grade), department: a.department, departmentLabel: deptLabel(a.department),
      roles: a.roles, allowedCategories: a.allowedCategories, locale: prefs.locale || 'fr',
      transparencyAccepted: !!prefs.transparencyAccepted, defaultScopes: prefs.defaultScopes || [], lastLoginAt: a.lastLoginAt
    };
  }
  function current() {
    var m = S.get('session');
    if (!m) return null;
    var a = agents().filter(function (x) { return x.matricule === m; })[0];
    return a ? profileOf(a) : null;
  }
  function needUser() { var u = current(); return u ? u : null; }
  function unauthorized() { return R(401, { code: 'UNAUTHENTICATED', message: 'Session expirée.' }); }

  /* ---------- Journal d'audit chaîné ---------- */

  var SEED_QUESTIONS = [
    ['Comment révise-t-on un roulement de boîtes d\'essieux ?', ['MAINTENANCE']],
    ['Quel est le jeu radial admissible d\'un roulement en service ?', ['MAINTENANCE']],
    ['Comment cantonner un train ?', ['TRANSPORT']],
    ['Quand le canton est-il libéré après le passage d\'un train ?', ['TRANSPORT']],
    ['Que faire du canton en cas de déraillement ?', []],
    ['Comment réaliser un essai complet des freins ?', ['TRANSPORT']],
    ['Quelle est la procédure disciplinaire du personnel en vigueur ?', ['RH']],
    ['Combien de jours de congé payé par mois de service ?', ['RH']],
    ['Quelle est la durée hebdomadaire de travail ?', []],
    ['Quel délai pour une réclamation pour avarie ?', ['COMMERCIAL']],
    ['Quelle est l\'échéance du contrat de concession ferroviaire ?', []],
    ['Quel est le taux de TVA en vigueur en 2026 ?', []],
    ['Quel est le menu de la cantine cette semaine ?', []]
  ];
  function entryHash(e) {
    return sha256([e.prevHash, e.id, e.timestamp, e.agentHash, e.grade, e.department, e.questionHash, e.answerHash, e.rbacFilter, e.retrievedCount, e.keptCount, e.model, e.confidence, e.faithfulness, e.outcome, e.latencyMs].join('|'));
  }
  function makeEntry(prev, ts, agent, question, scopes, result, latencyMs) {
    var e = {
      id: prev ? prev.id + 1 : 918001, timestamp: iso(ts), agentHash: sha256('agent:' + agent.matricule).slice(0, 16),
      grade: agent.grade, department: agent.department, questionHash: sha256(question).slice(0, 16),
      answerHash: sha256(result.refusal ? 'refus:' + result.refusal.reason : result.content).slice(0, 16),
      rbacFilter: result.rbacFilter, retrievedCount: result.retrievedCount, keptCount: result.keptCount,
      model: result.model.id, confidence: result.confidence, faithfulness: result.refusal ? (result.refusal.faithfulness == null ? null : result.refusal.faithfulness) : result.faithfulness,
      outcome: result.refusal ? 'refused' : 'answered', latencyMs: latencyMs, prevHash: prev ? prev.hash : sha256('genesis').slice(0, 16),
      scope: (scopes && scopes[0]) || (result.citations && result.citations[0] ? result.citations[0].category : (result.refusal && result.refusal.nearestSources && result.refusal.nearestSources[0] ? result.refusal.nearestSources[0].category : 'MAINTENANCE'))
    };
    e.hash = entryHash(e).slice(0, 16);
    return e;
  }
  function seedAudit() {
    var rnd = prng(42), list = [], prev = null, all = seedAgents().filter(function (a) { return a.enabled; });
    for (var day = 120; day >= 1; day--) {
      var n = 2 + Math.floor(rnd() * 5);
      for (var k = 0; k < n; k++) {
        var agent = all[Math.floor(rnd() * all.length)];
        // Les agents posent surtout des questions de leur périmètre (80 %), parfois hors périmètre.
        var own = SEED_QUESTIONS.filter(function (x) { return x[1].length && agent.allowedCategories.indexOf(x[1][0]) >= 0; });
        var pool_ = own.length && rnd() < 0.8 ? own : SEED_QUESTIONS;
        var q = pool_[Math.floor(rnd() * pool_.length)];
        var res = answer(q[0], profileOf(agent), q[1]);
        // Latence : tirée dans le budget de conception du dossier (4-5 s simple, 14-15 s multi-hop), pas une mesure.
        var lat = res.queryClass === 'multi_hop' ? 14000 + Math.floor(rnd() * 1000) : 4000 + Math.floor(rnd() * 1000);
        var ts = NOW - day * DAY + Math.floor((7 + rnd() * 10) * 3600000);
        prev = makeEntry(prev, ts, agent, q[0], q[1], res, lat);
        list.push(prev);
      }
    }
    return list;
  }
  function audit() { var a = S.get('audit'); if (!a) { a = seedAudit(); S.set('audit', a); } return a; }
  function appendAudit(user, question, scopes, res, lat) {
    var list = audit();
    var e = makeEntry(list[list.length - 1], Date.now(), user, question, scopes, res, lat);
    list.push(e); S.set('audit', list);
  }

  /* ---------- Conversations ---------- */

  function convKey(u) { return 'conv_' + u.matricule; }
  function assistantMessage(res, user, id, ts, latencyMs) {
    var m = { id: id, role: 'assistant', createdAt: iso(ts), model: res.model, queryClass: res.queryClass, confidence: res.confidence, latencyMs: latencyMs, iterations: 1, citations: res.citations || [] };
    if (res.refusal) { m.content = ''; m.refusal = res.refusal; m.faithfulness = res.refusal.faithfulness == null ? null : res.refusal.faithfulness; m.citations = []; }
    else { m.content = res.content; m.faithfulness = res.faithfulness; m.refusal = null; if (res.critical) m.criticalVerification = verification(user); }
    return m;
  }
  function seedConversations(user) {
    var defs = {
      'AG-01001': [['Révision roulement boîtes d\'essieux', ['MAINTENANCE'], ['Comment révise-t-on un roulement de boîtes d\'essieux ?', 'Quel est le jeu radial admissible d\'un roulement en service ?'], 2],
                   ['Cantonnement sur voie unique', ['TRANSPORT'], ['Comment cantonner un train ?'], 5]],
      'AU-02002': [['Essais de freins', ['TRANSPORT'], ['Comment réaliser un essai complet des freins ?'], 1]],
      'AD-03003': [['Échéance de la concession', [], ['Quelle est l\'échéance du contrat de concession ferroviaire ?'], 3]]
    }[user.matricule] || [];
    return defs.map(function (d, i) {
      var t0 = NOW - d[3] * DAY, msgs = [];
      d[2].forEach(function (q, j) {
        var ts = t0 + j * 240000;
        msgs.push({ id: 'ms_s' + i + '_' + j + 'u', role: 'user', content: q, createdAt: iso(ts) });
        var res = answer(q, user, d[1]);
        msgs.push(assistantMessage(res, user, 'ms_s' + i + '_' + j + 'a', ts + 5000, res.queryClass === 'multi_hop' ? 14200 : 4300));
      });
      return { id: 'cv_seed' + i + '_' + user.matricule.toLowerCase(), title: d[0], createdAt: iso(t0), updatedAt: msgs[msgs.length - 1].createdAt, scopes: d[1], messages: msgs };
    });
  }
  function conversations(u) {
    var list = S.get(convKey(u));
    if (!list) { list = seedConversations(u); S.set(convKey(u), list); }
    return list;
  }
  function saveConversations(u, list) { S.set(convKey(u), list); }
  function summary(c) { return { id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, messageCount: c.messages.length, scopes: c.scopes }; }

  /* ---------- Documents ---------- */

  function docItem(d) {
    var chunks = d.passages.length ? d.passages.length * 37 + d.pageCount * 3 : 0;
    return {
      id: d.id, title: d.title, reference: d.reference, category: d.category, documentClass: d.documentClass, department: d.department,
      gradeMin: d.gradeMin, pageCount: d.pageCount, sourceType: d.sourceType, ocrEngine: d.ocrEngine, stamped: d.stamped, status: d.status,
      chunkCount: chunks, hasTables: d.hasTables, version: d.version, effectiveDate: d.effectiveDate, lifecycle: d.lifecycle, supersededBy: d.supersededBy,
      indexedAt: d.indexedAt ? iso(d.indexedAt) : null, updatedAt: iso(d.indexedAt || NOW - 2 * DAY)
    };
  }
  function visibleDoc(d, u) { return u.roles.indexOf('ADMIN') >= 0 || (d.gradeMin <= u.grade && u.allowedCategories.indexOf(d.category) >= 0); }
  function ingestion(d) {
    var keys = [
      ['extraction', 'Extraction PyMuPDF'],
      ['ocr', d.ocrEngine === 'glm-ocr' ? 'GLM-OCR' : d.ocrEngine ? 'PaddleOCR-VL 1.6' : 'OCR non requis (PDF natif)'],
      ['correction', 'Post-correction lexique ferroviaire'],
      ['tables', 'Extraction des tableaux (TATR)'],
      ['chunking', 'Segmentation parent-child 128 / 512 tokens'],
      ['embedding', 'Qwen3-Embedding-8B'],
      ['indexing', 'Indexation Qdrant']
    ];
    var stopAt = d.status === 'embedding' ? 5 : d.status === 'failed' ? 1 : 99;
    var base = d.indexedAt || NOW - DAY;
    return {
      status: d.status,
      steps: keys.map(function (k, i) {
        var st = i < stopAt ? 'done' : i === stopAt ? (d.status === 'failed' ? 'failed' : 'running') : 'pending';
        return { key: k[0], label: k[1], status: st, finishedAt: st === 'done' ? iso(base - (7 - i) * 60000) : null };
      }),
      errorMessage: d.errorMessage || null
    };
  }
  function pageText(d, n) {
    var ps = d.passages.filter(function (p) { return p[0] === n; });
    if (!ps.length) return FICTIF + 'Page ' + n + ' de « ' + d.title + ' » : contenu non reproduit dans la démo.';
    return FICTIF + ps.map(function (p) { return p[1] + ' · ' + p[2] + '\n' + p[3]; }).join('\n\n');
  }

  /* ---------- Routes : authentification ---------- */

  route('POST', /^\/auth\/login$/, function (ctx) {
    var b = ctx.body || {};
    var m = String(b.matricule || '').trim().toUpperCase();
    var a = agents().filter(function (x) { return x.matricule === m; })[0];
    if (!a || !String(b.password || '').length) return R(401, { code: 'INVALID_CREDENTIALS', message: 'Matricule ou mot de passe incorrect.' });
    if (!a.enabled) return R(403, { code: 'ACCOUNT_DISABLED', message: 'Compte désactivé.' });
    S.set('session', a.matricule);
    a.lastLoginAt = iso(Date.now()); S.set('agents', agents().map(function (x) { return x.matricule === a.matricule ? a : x; }));
    return { accessToken: 'demo.' + sha256(a.matricule + Date.now()).slice(0, 24), expiresAt: iso(Date.now() + 8 * 3600000), user: profileOf(a) };
  });
  route('GET', /^\/auth\/me$/, function () { var u = current(); return u ? u : unauthorized(); });
  route('POST', /^\/auth\/logout$/, function () { S.set('session', null); return R(204, null); });
  route('POST', /^\/auth\/transparency-ack$/, function () {
    var u = current(); if (!u) return unauthorized();
    var p = S.get('prefs_' + u.matricule) || {}; p.transparencyAccepted = true; S.set('prefs_' + u.matricule, p);
    return R(204, null);
  });
  route('PATCH', /^\/auth\/me\/preferences$/, function (ctx) {
    var u = current(); if (!u) return unauthorized();
    var p = S.get('prefs_' + u.matricule) || {}, b = ctx.body || {};
    if (b.locale) p.locale = b.locale;
    if (Array.isArray(b.defaultScopes)) p.defaultScopes = b.defaultScopes;
    S.set('prefs_' + u.matricule, p);
    return current();
  });
  route('GET', /^\/admin\/scopes$/, function () { return SCOPES; });
  route('GET', /^\/health$/, function () {
    return { status: 'ok', components: { dotnet: 'ok', fastapi: 'ok', postgres: 'ok', qdrant: 'ok', redis: 'ok', vault: 'ok' } };
  });

  /* ---------- Routes : conversations ---------- */

  route('GET', /^\/conversations$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var s = norm(ctx.query.search || '');
    var list = conversations(u).filter(function (c) { return !s || norm(c.title).indexOf(s) >= 0; })
      .sort(function (a, b) { return b.updatedAt < a.updatedAt ? -1 : 1; }).map(summary);
    return page(list, ctx.query, 50);
  });
  route('POST', /^\/conversations$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var b = ctx.body || {}, now = iso(Date.now());
    var c = { id: uid('cv'), title: b.title || 'Nouvelle conversation', createdAt: now, updatedAt: now, scopes: b.scopes || [], messages: [], untitled: !b.title };
    var list = conversations(u); list.push(c); saveConversations(u, list);
    return R(201, summary(c));
  });
  route('GET', /^\/conversations\/([^/]+)$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var c = conversations(u).filter(function (x) { return x.id === decodeURIComponent(ctx.params[1]); })[0];
    return c ? { id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, scopes: c.scopes, messageCount: c.messages.length, messages: c.messages } : R(404, { code: 'NOT_FOUND', message: 'Conversation introuvable.' });
  });
  route('PATCH', /^\/conversations\/([^/]+)$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var list = conversations(u), c = list.filter(function (x) { return x.id === decodeURIComponent(ctx.params[1]); })[0];
    if (!c) return R(404, { code: 'NOT_FOUND', message: 'Conversation introuvable.' });
    if (ctx.body && ctx.body.title) { c.title = String(ctx.body.title); c.untitled = false; }
    saveConversations(u, list);
    return summary(c);
  });
  route('DELETE', /^\/conversations\/([^/]+)$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    saveConversations(u, conversations(u).filter(function (x) { return x.id !== decodeURIComponent(ctx.params[1]); }));
    return R(204, null);
  });

  /* ---------- Routes : génération (flux SSE simulé) ---------- */

  route('POST', /^\/chat\/ask$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var b = ctx.body || {}, question = String(b.question || '').trim(), scopes = b.scopes || [];
    if (!question) return R(400, { code: 'EMPTY_QUESTION', message: 'Question vide.' });
    var list = conversations(u), conv = list.filter(function (x) { return x.id === b.conversationId; })[0];
    if (!conv) return R(404, { code: 'NOT_FOUND', message: 'Conversation introuvable.' });
    var started = Date.now();
    var res = answer(question, u, scopes);
    var mid = uid('ms');
    var ev = [];
    ev.push({ wait: 60, data: { type: 'accepted', messageId: mid, conversationId: conv.id, queryClass: res.queryClass } });
    var stg = stagesFor(res.queryClass);
    stg.forEach(function (s) {
      if (s === 'generation' && res.citations && !res.refusal) ev.push({ wait: 0, data: { type: 'citations', citations: res.citations } });
      ev.push({ wait: s === 'graph' ? 650 : 330, data: { type: 'stage', stage: s, iteration: 1 } });
    });
    if (res.refusal) {
      ev.push({ wait: 350, data: { type: 'refusal', reason: res.refusal.reason, faithfulness: res.refusal.faithfulness, confidence: res.refusal.confidence, message: res.refusal.message, nearestSources: res.refusal.nearestSources } });
    } else {
      var words = res.content.split(/(\s+)/), chunk = '';
      for (var i = 0; i < words.length; i++) {
        chunk += words[i];
        if (chunk.length > 18 || i === words.length - 1) { ev.push({ wait: 45, data: { type: 'token', text: chunk } }); chunk = ''; }
      }
    }
    var doneEvent = { type: 'done', model: res.model, queryClass: res.queryClass, modelFallback: false, faithfulness: res.refusal ? (res.refusal.faithfulness == null ? undefined : res.refusal.faithfulness) : res.faithfulness, confidence: res.confidence, iterations: 1 };
    if (!res.refusal && res.critical) doneEvent.criticalVerification = verification(u);
    ev.push({
      wait: 120,
      run: function () {
        // Latence affichée = durée réelle de la simulation dans le navigateur.
        var lat = Date.now() - started;
        doneEvent.latencyMs = lat;
        var nowIso = iso(Date.now());
        var l2 = conversations(u), c2 = l2.filter(function (x) { return x.id === conv.id; })[0];
        if (c2) {
          c2.messages.push({ id: uid('ms') + 'u', role: 'user', content: question, createdAt: iso(started) });
          c2.messages.push(assistantMessage(res, u, mid, Date.now(), lat));
          if (c2.untitled) { c2.title = question.length > 60 ? question.slice(0, 57) + '…' : question; c2.untitled = false; }
          c2.updatedAt = nowIso;
          saveConversations(u, l2);
        }
        appendAudit(u, question, scopes, res, lat);
      },
      data: doneEvent
    });
    return { __r: true, status: 200, body: null, headers: {}, stream: ev };
  });
  route('POST', /^\/chat\/stop$/, function () { return R(204, null); });
  route('POST', /^\/chat\/messages\/([^/]+)\/feedback$/, function () { return R(204, null); });

  /* ---------- Routes : documents ---------- */

  route('GET', /^\/documents$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var q = ctx.query, s = norm(q.search || '');
    var list = DOCS.filter(function (d) { return visibleDoc(d, u); })
      .filter(function (d) { return !s || norm(d.title + ' ' + d.reference).indexOf(s) >= 0; })
      .filter(function (d) { return !q.category || d.category === q.category; })
      .filter(function (d) { return !q.status || d.status === q.status; })
      .map(docItem);
    return page(list, q, 20);
  });
  route('GET', /^\/documents\/([^/]+)\/pages\/(\d+)$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var d = DOC_BY_ID[decodeURIComponent(ctx.params[1])];
    if (!d || !visibleDoc(d, u)) return R(404, { code: 'NOT_FOUND', message: 'Document introuvable.' });
    var n = Number(ctx.params[2]);
    return { page: n, text: pageText(d, n), imageUrl: null };
  });
  route('GET', /^\/documents\/([^/]+)$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var d = DOC_BY_ID[decodeURIComponent(ctx.params[1])];
    if (!d || !visibleDoc(d, u)) return R(404, { code: 'NOT_FOUND', message: 'Document introuvable.' });
    var o = docItem(d); o.ingestion = ingestion(d);
    return o;
  });
  route('POST', /^\/documents$/, function () { return R(403, { code: 'DEMO_READ_ONLY', message: 'Téléversement désactivé dans la démo.' }); });
  route('DELETE', /^\/documents\/([^/]+)$/, function () { return R(403, { code: 'DEMO_READ_ONLY', message: 'Suppression désactivée dans la démo.' }); });

  /* ---------- Routes : audit ---------- */

  function requireRole(role) { var u = current(); if (!u) return unauthorized(); if (u.roles.indexOf(role) < 0) return R(403, { code: 'RBAC_FORBIDDEN', message: 'Rôle ' + role + ' requis.' }); return null; }
  function publicEntry(e) { var o = clone(e); delete o.scope; return o; }
  function filterAudit(q) {
    return audit().filter(function (e) {
      if (q.from && e.timestamp < q.from) return false;
      if (q.to && e.timestamp.slice(0, 10) > q.to) return false;
      if (q.agentHash && e.agentHash.indexOf(q.agentHash) !== 0) return false;
      if (q.model && e.model !== q.model) return false;
      if (q.outcome && e.outcome !== q.outcome) return false;
      return true;
    }).slice().reverse();
  }
  route('GET', /^\/audit\/entries$/, function (ctx) {
    var no = requireRole('AUDITEUR'); if (no) return no;
    var r = page(filterAudit(ctx.query), ctx.query, 25); r.items = r.items.map(publicEntry); return r;
  });
  route('GET', /^\/audit\/entries\/(\d+)$/, function (ctx) {
    var no = requireRole('AUDITEUR'); if (no) return no;
    var e = audit().filter(function (x) { return x.id === Number(ctx.params[1]); })[0];
    return e ? publicEntry(e) : R(404, { code: 'NOT_FOUND', message: 'Entrée introuvable.' });
  });
  route('POST', /^\/audit\/verify$/, function (ctx) {
    var no = requireRole('AUDITEUR'); if (no) return no;
    var b = ctx.body || {}, list = audit(), bad = null, n = 0;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (b.fromId && e.id < b.fromId) continue;
      if (b.toId && e.id > b.toId) break;
      n++;
      var expectedPrev = i ? list[i - 1].hash : sha256('genesis').slice(0, 16);
      if (e.prevHash !== expectedPrev || entryHash(e).slice(0, 16) !== e.hash) { bad = e.id; break; }
    }
    return { valid: bad === null, checkedCount: n, firstInvalidId: bad, verifiedAt: iso(Date.now()) };
  });
  route('GET', /^\/audit\/export$/, function (ctx) {
    var no = requireRole('AUDITEUR'); if (no) return no;
    var cols = ['id', 'timestamp', 'agentHash', 'grade', 'department', 'questionHash', 'answerHash', 'model', 'confidence', 'faithfulness', 'outcome', 'latencyMs', 'prevHash', 'hash'];
    var rows = filterAudit(ctx.query).map(function (e) { return cols.map(function (c) { return e[c] == null ? '' : String(e[c]); }).join(';'); });
    return R(200, '# Journal d\'audit simulé (démo, données fictives)\n' + cols.join(';') + '\n' + rows.join('\n') + '\n', { 'content-type': 'text/csv; charset=utf-8' });
  });

  /* ---------- Routes : administration ---------- */

  route('GET', /^\/admin\/agents$/, function (ctx) {
    var no = requireRole('ADMIN'); if (no) return no;
    var q = ctx.query, s = norm(q.search || '');
    var list = agents().filter(function (a) { return !s || norm(a.fullName + ' ' + a.matricule).indexOf(s) >= 0; })
      .filter(function (a) { return !q.department || a.department === q.department; })
      .filter(function (a) { return !q.grade || a.grade === Number(q.grade); });
    return page(list, q, 20);
  });
  route('POST', /^\/admin\/agents$/, function (ctx) {
    var no = requireRole('ADMIN'); if (no) return no;
    var b = ctx.body || {}, m = String(b.matricule || '').trim().toUpperCase();
    if (!m || !b.fullName) return R(422, { code: 'VALIDATION', message: 'Matricule et nom requis.', fieldErrors: { matricule: !m ? 'Requis' : undefined, fullName: !b.fullName ? 'Requis' : undefined } });
    var list = agents();
    if (list.some(function (a) { return a.matricule === m; })) return R(409, { code: 'CONFLICT', message: 'Matricule déjà utilisé.' });
    var a = { id: m, matricule: m, fullName: String(b.fullName), email: b.email ? String(b.email).replace(/@.*$/, '@exemple.org') : mail(b.fullName), grade: Number(b.grade) || 1, department: b.department || 'MAINTENANCE', roles: ['AGENT'], allowedCategories: [b.department || 'MAINTENANCE'].filter(function (c) { return SCOPES.some(function (s) { return s.code === c; }); }), enabled: true, lastLoginAt: null };
    list.push(a); S.set('agents', list);
    return R(201, a);
  });
  route('PATCH', /^\/admin\/agents\/([^/]+)$/, function (ctx) {
    var no = requireRole('ADMIN'); if (no) return no;
    var list = agents(), a = list.filter(function (x) { return x.id === decodeURIComponent(ctx.params[1]); })[0];
    if (!a) return R(404, { code: 'NOT_FOUND', message: 'Agent introuvable.' });
    Object.keys(ctx.body || {}).forEach(function (k) { if (k !== 'id' && k !== 'matricule') a[k] = ctx.body[k]; });
    S.set('agents', list); return a;
  });
  route('POST', /^\/admin\/agents\/([^/]+)\/disable$/, function (ctx) {
    var no = requireRole('ADMIN'); if (no) return no;
    var id = decodeURIComponent(ctx.params[1]);
    if (id === S.get('session')) return R(409, { code: 'CONFLICT', message: 'Impossible de désactiver votre propre compte.' });
    S.set('agents', agents().map(function (a) { if (a.id === id) a.enabled = false; return a; }));
    return R(204, null);
  });
  route('POST', /^\/admin\/agents\/([^/]+)\/reset-password$/, function () { var no = requireRole('ADMIN'); return no || R(204, null); });
  [['grades', GRADES], ['departments', DEPARTMENTS], ['categories', CATEGORIES]].forEach(function (pair) {
    var key = pair[0];
    function get() { var v = S.get('ref_' + key); if (!v) { v = clone(pair[1]); S.set('ref_' + key, v); } return v; }
    route('GET', new RegExp('^/admin/' + key + '$'), function () { var no = requireRole('ADMIN'); return no || get(); });
    route('POST', new RegExp('^/admin/' + key + '$'), function (ctx) {
      var no = requireRole('ADMIN'); if (no) return no;
      var v = get(), o = clone(ctx.body || {}); o.id = uid(key.charAt(0)); v.push(o); S.set('ref_' + key, v); return R(201, o);
    });
    route('PATCH', new RegExp('^/admin/' + key + '/([^/]+)$'), function (ctx) {
      var no = requireRole('ADMIN'); if (no) return no;
      var v = get(), o = v.filter(function (x) { return x.id === ctx.params[1]; })[0];
      if (!o) return R(404, { code: 'NOT_FOUND', message: 'Élément introuvable.' });
      Object.assign(o, ctx.body || {}); S.set('ref_' + key, v); return o;
    });
    route('DELETE', new RegExp('^/admin/' + key + '/([^/]+)$'), function (ctx) {
      var no = requireRole('ADMIN'); if (no) return no;
      S.set('ref_' + key, get().filter(function (x) { return x.id !== ctx.params[1]; })); return R(204, null);
    });
  });

  /* ---------- Routes : indicateurs (calculés sur le journal simulé) ---------- */

  function rangeDays(r) { return r === '7d' ? 7 : r === '90d' ? 90 : 30; }
  function window_(days, offset) {
    var to = Date.now() - offset * days * DAY, from = to - days * DAY;
    return audit().filter(function (e) { var t = Date.parse(e.timestamp); return t > from && t <= to; });
  }
  function stats(list) {
    var ans = list.filter(function (e) { return e.outcome === 'answered'; });
    function mean(a, f) { return a.length ? a.reduce(function (s, e) { return s + f(e); }, 0) / a.length : 0; }
    var agentsSet = {}; list.forEach(function (e) { agentsSet[e.agentHash] = 1; });
    return {
      questions: list.length, answerRate: list.length ? ans.length / list.length : 0, refusalRate: list.length ? 1 - ans.length / list.length : 0,
      avgFaithfulness: mean(ans, function (e) { return e.faithfulness || 0; }), avgConfidence: mean(list, function (e) { return e.confidence || 0; }),
      avgLatencyMs: mean(list, function (e) { return e.latencyMs; }), reasoning: mean(list, function (e) { return e.model === MODELS.reasoning.id ? 1 : 0; }),
      activeAgents: Object.keys(agentsSet).length
    };
  }
  function m(cur, prev, rel) { return { value: cur, delta: rel ? (prev ? (cur - prev) / prev : 0) : cur - prev }; }
  route('GET', /^\/metrics\/overview$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var d = rangeDays(ctx.query.range), a = stats(window_(d, 0)), b = stats(window_(d, 1));
    var indexed = DOCS.filter(function (x) { return x.status === 'indexed'; }).length;
    return {
      questions: m(a.questions, b.questions, true), answerRate: m(a.answerRate, b.answerRate), refusalRate: m(a.refusalRate, b.refusalRate),
      avgFaithfulness: m(a.avgFaithfulness, b.avgFaithfulness), avgConfidence: m(a.avgConfidence, b.avgConfidence),
      avgLatencyMs: m(Math.round(a.avgLatencyMs), Math.round(b.avgLatencyMs)), modelSplit: { light: 1 - a.reasoning, reasoning: a.reasoning },
      indexedDocuments: { value: indexed, delta: 0 }, activeAgents: m(a.activeAgents, b.activeAgents)
      // Pas de moyennes RAGAS : elles exigeraient une évaluation réelle sur un golden dataset.
    };
  });
  route('GET', /^\/metrics\/timeseries$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var d = rangeDays(ctx.query.range), list = window_(d, 0), pts = [];
    for (var i = d - 1; i >= 0; i--) {
      var day = iso(Date.now() - i * DAY).slice(0, 10);
      pts.push({ t: day, v: list.filter(function (e) { return e.timestamp.slice(0, 10) === day; }).length });
    }
    return { metric: ctx.query.metric || 'questions', unit: 'count', points: pts };
  });
  route('GET', /^\/metrics\/scopes$/, function (ctx) {
    var u = needUser(); if (!u) return unauthorized();
    var list = window_(rangeDays(ctx.query.range), 0);
    return SCOPES.map(function (s) {
      var l = list.filter(function (e) { return e.scope === s.code; });
      return { code: s.code, questions: l.length, refusalRate: l.length ? l.filter(function (e) { return e.outcome === 'refused'; }).length / l.length : 0 };
    }).filter(function (r) { return r.questions > 0; });
  });
  // Journal d'évaluation du golden dataset : volontairement vide (aucune évaluation réelle à montrer).
  route('GET', /^\/metrics\/quality-runs$/, function () { return []; });

  /* ---------- Voix : désactivée dans le build de démo ---------- */
  route('POST', /^\/voice\/transcribe$/, function () { return R(503, { code: 'ASR_DISABLED', message: 'Interface vocale désactivée dans la démo.' }); });
  route('GET', /^\/voice\/speak\/([^/]+)$/, function () { return R(503, { code: 'TTS_DISABLED', message: 'Interface vocale désactivée dans la démo.' }); });

  /* ====================================================================== */
  /* 2. Noyau commun (identique sur tous les sites de démo)                 */
  /* ====================================================================== */

  function route(method, re, fn) { SITE.routes.push({ method: method, re: re, fn: fn }); }

  // État de démo persistant pour l'onglet (sessionStorage, repli en mémoire).
  var MEM = {};
  var S = {
    key: function (k) { return '__demo_' + SITE.name + '_' + k; },
    get: function (k, def) {
      try { var v = sessionStorage.getItem(S.key(k)); if (v != null) return JSON.parse(v); } catch (e) { if (S.key(k) in MEM) return MEM[S.key(k)]; }
      return def;
    },
    set: function (k, v) { MEM[S.key(k)] = v; try { sessionStorage.setItem(S.key(k), JSON.stringify(v)); } catch (e) { /* mémoire seule */ } }
  };

  function R(status, body, headers) { return { __r: true, status: status, body: body, headers: headers || {} }; }

  var DEMO = window.__DEMO_MOCK__ = { site: SITE.name, calls: [], blocked: [], R: R, S: S };
  var STATIC_HOSTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/i;

  function toURL(url) { try { return new URL(String(url), location.href); } catch (e) { return null; } }

  // 'pass' : ressource statique du site ou CDN public ; 'mock' : tout le reste.
  function classify(url) {
    var u = toURL(url);
    if (!u) return 'mock';
    if (u.protocol === 'data:' || u.protocol === 'blob:') return 'pass';
    if (u.origin === location.origin) return SITE.isApi(u) ? 'mock' : 'pass';
    if (STATIC_HOSTS.test(u.hostname) && !(SITE.isApi(u))) return 'pass';
    return 'mock';
  }

  function parseBody(b) {
    if (b == null) return null;
    if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return b; } }
    try {
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        var o = {}; b.forEach(function (v, k) { o[k] = (typeof File !== 'undefined' && v instanceof File) ? v.name : v; }); return o;
      }
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) {
        var q = {}; b.forEach(function (v, k) { q[k] = v; }); return q;
      }
    } catch (e) { /* ignore */ }
    return b;
  }

  function resolve(method, url, body, headers) {
    var u = toURL(url) || new URL(location.origin);
    var query = {};
    u.searchParams.forEach(function (v, k) { query[k] = v; });
    var ctx = { method: String(method || 'GET').toUpperCase(), url: u, path: u.pathname.replace(/^\/api(?=\/|$)/, '') || '/', query: query, body: parseBody(body), headers: headers || {} };
    var out;
    try {
      for (var i = 0; i < SITE.routes.length; i++) {
        var r = SITE.routes[i];
        if (r.method !== '*' && r.method !== ctx.method) continue;
        var m = ctx.path.match(r.re) || (u.href.match(r.re));
        if (!m) continue;
        ctx.params = m;
        out = r.fn(ctx);
        if (out !== undefined) break;
      }
    } catch (e) {
      try { console.warn('[démo] erreur du mock', ctx.method, ctx.path, e); } catch (e2) { /* ignore */ }
      out = undefined;
    }
    var matched = out !== undefined;
    if (!matched) out = SITE.fallback(ctx);
    var res = out && out.__r ? out : R(200, out);
    DEMO.calls.push({ method: ctx.method, url: u.href, status: res.status, matched: matched });
    return res;
  }

  function delay() { return SITE.delay ? SITE.delay() : 200 + Math.floor(Math.random() * 300); }

  function bodyText(res) {
    if (res.body === undefined || res.body === null) return res.status === 204 ? '' : 'null';
    return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  }
  function contentType(res) {
    return res.headers['content-type'] || (typeof res.body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
  }
  var STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };

  /* ---- fetch ---- */
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    init = init || {};
    var isReq = typeof Request !== 'undefined' && input instanceof Request;
    var url = isReq ? input.url : (input && input.href) || String(input);
    if (classify(url) === 'pass') return realFetch(input, init);
    var method = init.method || (isReq ? input.method : 'GET');
    var signal = init.signal || (isReq ? input.signal : null);
    var hdrs = {};
    try { new Headers(init.headers || (isReq ? input.headers : undefined)).forEach(function (v, k) { hdrs[k] = v; }); } catch (e) { /* ignore */ }
    var bodyP = init.body !== undefined ? Promise.resolve(init.body) : (isReq && method !== 'GET' && method !== 'HEAD' ? input.clone().text() : Promise.resolve(null));
    return bodyP.then(function (b) {
      return new Promise(function (ok, ko) {
        if (signal && signal.aborted) return ko(new DOMException('Aborted', 'AbortError'));
        var t = setTimeout(function () {
          var res = resolve(method, url, b, hdrs);
          if (res.stream) { ok(streamResponse(res, signal)); return; }
          var noBody = res.status === 204 || res.status === 304 || String(method).toUpperCase() === 'HEAD';
          var h = new Headers(res.headers); h.set('content-type', contentType(res));
          var resp = new Response(noBody ? null : bodyText(res), { status: res.status, statusText: STATUS_TEXT[res.status] || '', headers: h });
          try { Object.defineProperty(resp, 'url', { value: toURL(url).href }); } catch (e) { /* ignore */ }
          ok(resp);
        }, delay());
        if (signal) signal.addEventListener('abort', function () { clearTimeout(t); ko(new DOMException('Aborted', 'AbortError')); });
      });
    });
  };

  /* ---- Flux (text/event-stream) : res.stream = [{ wait: ms, data: objet|chaîne }] ---- */
  function streamResponse(res, signal) {
    var enc = new TextEncoder();
    var timers = [];
    var body = new ReadableStream({
      start: function (ctrl) {
        var t = 0, closed = false;
        function end(err) { if (closed) return; closed = true; timers.forEach(clearTimeout); try { if (err) ctrl.error(err); else ctrl.close(); } catch (e) { /* déjà fermé */ } }
        if (signal) signal.addEventListener('abort', function () { end(new DOMException('Aborted', 'AbortError')); });
        res.stream.forEach(function (ev) {
          t += ev.wait || 0;
          timers.push(setTimeout(function () {
            if (closed) return;
            if (typeof ev.run === 'function') { try { ev.run(); } catch (e) { /* ignore */ } }
            if (ev.data !== undefined) ctrl.enqueue(enc.encode('data: ' + (typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)) + String.fromCharCode(10, 10)));
          }, t));
        });
        timers.push(setTimeout(function () { end(); }, t + 10));
      },
      cancel: function () { timers.forEach(clearTimeout); }
    });
    var h = new Headers(res.headers); h.set('content-type', 'text/event-stream; charset=utf-8');
    return new Response(body, { status: res.status, headers: h });
  }

  /* ---- XMLHttpRequest (axios) ---- */
  var XP = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (XP) {
    var oOpen = XP.open, oSend = XP.send, oSet = XP.setRequestHeader, oAbort = XP.abort,
      oAll = XP.getAllResponseHeaders, oOne = XP.getResponseHeader, oMime = XP.overrideMimeType;
    var fire = function (xhr, type) {
      var ev;
      try { ev = type === 'readystatechange' ? new Event(type) : new ProgressEvent(type, { lengthComputable: false }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent(type, false, false); }
      xhr.dispatchEvent(ev);
    };
    var defineState = function (xhr, st) {
      ['readyState', 'status', 'statusText', 'responseText', 'response', 'responseURL', 'responseXML'].forEach(function (p) {
        Object.defineProperty(xhr, p, { configurable: true, get: function () { return st[p]; } });
      });
    };
    XP.open = function (method, url) {
      if (classify(url) === 'pass') { this.__demo = null; return oOpen.apply(this, arguments); }
      var st = { readyState: 1, status: 0, statusText: '', responseText: '', response: '', responseURL: '', responseXML: null };
      this.__demo = { method: method, url: url, headers: {}, st: st, aborted: false, timer: null, resHeaders: '' };
      defineState(this, st);
      fire(this, 'readystatechange');
    };
    XP.setRequestHeader = function (k, v) { if (this.__demo) { this.__demo.headers[String(k).toLowerCase()] = v; return; } return oSet.apply(this, arguments); };
    XP.overrideMimeType = function () { if (this.__demo) return; return oMime.apply(this, arguments); };
    XP.getAllResponseHeaders = function () { return this.__demo ? this.__demo.resHeaders : oAll.apply(this, arguments); };
    XP.getResponseHeader = function (name) {
      if (!this.__demo) return oOne.apply(this, arguments);
      var m = this.__demo.resHeaders.match(new RegExp('^' + String(name).replace(/[-]/g, '\\-') + ':\\s*(.*)$', 'im'));
      return m ? m[1].trim() : null;
    };
    XP.abort = function () {
      var d = this.__demo;
      if (!d) return oAbort.apply(this, arguments);
      d.aborted = true; clearTimeout(d.timer);
      d.st.readyState = 4; d.st.status = 0;
      fire(this, 'readystatechange'); fire(this, 'abort'); fire(this, 'loadend');
    };
    XP.send = function (body) {
      var d = this.__demo, xhr = this;
      if (!d) return oSend.apply(this, arguments);
      fire(xhr, 'loadstart');
      d.timer = setTimeout(function () {
        if (d.aborted) return;
        var res = resolve(d.method, d.url, body, d.headers);
        var text = bodyText(res);
        var st = d.st;
        var hdr = Object.assign({}, res.headers, { 'content-type': contentType(res) });
        d.resHeaders = Object.keys(hdr).map(function (k) { return k + ': ' + hdr[k]; }).join('\r\n') + '\r\n';
        st.status = res.status; st.statusText = STATUS_TEXT[res.status] || '';
        st.responseURL = (toURL(d.url) || {}).href || '';
        st.responseText = text;
        var rt = xhr.responseType;
        if (rt === 'json') { try { st.response = JSON.parse(text); } catch (e) { st.response = null; } }
        else if (rt === 'blob') st.response = new Blob([text], { type: hdr['content-type'] });
        else if (rt === 'arraybuffer') st.response = new TextEncoder().encode(text).buffer;
        else st.response = text;
        st.readyState = 2; fire(xhr, 'readystatechange');
        st.readyState = 3; fire(xhr, 'readystatechange');
        st.readyState = 4; fire(xhr, 'readystatechange');
        fire(xhr, 'load'); fire(xhr, 'loadend');
      }, delay());
    };
  }

  /* ---- WebSocket / EventSource : stubs qui n'ouvrent rien ---- */
  function makeStub(kind) {
    function Stub(url) {
      var et = new EventTarget();
      this._et = et;
      this.url = String(url); this.readyState = 0; this.protocol = ''; this.extensions = '';
      this.bufferedAmount = 0; this.binaryType = 'blob'; this.withCredentials = false;
      this.onopen = this.onmessage = this.onerror = this.onclose = null;
      DEMO.blocked.push(kind + ' ' + this.url);
    }
    Stub.prototype.addEventListener = function (t, f, o) { if (this._et) this._et.addEventListener(t, f, o); };
    Stub.prototype.removeEventListener = function (t, f, o) { if (this._et) this._et.removeEventListener(t, f, o); };
    Stub.prototype.dispatchEvent = function (e) { return this._et ? this._et.dispatchEvent(e) : true; };
    Stub.prototype.send = function () { /* rien n'est envoyé en démo */ };
    Stub.prototype.close = function () { this.readyState = kind === 'WebSocket' ? 3 : 2; };
    Stub.CONNECTING = 0; Stub.OPEN = 1; Stub.CLOSING = 2; Stub.CLOSED = kind === 'WebSocket' ? 3 : 2;
    return Stub;
  }
  window.WebSocket = makeStub('WebSocket');
  if (window.EventSource) window.EventSource = makeStub('EventSource');
  if (navigator.sendBeacon) {
    var oBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) { if (classify(url) === 'pass') return oBeacon(url, data); DEMO.blocked.push('beacon ' + url); return true; };
  }

  /* ---- Bandeau « Démo · données simulées » ---- */
  function banner() {
    if (document.getElementById('__demo-badge')) return;
    var b = document.createElement('div');
    b.id = '__demo-badge';
    b.setAttribute('role', 'note');
    b.textContent = SITE.badge || 'Démo · données simulées';
    var place = typeof SITE.badgeCss === 'function' ? SITE.badgeCss() : SITE.badgeCss;
    b.style.cssText = (place || 'left:10px;bottom:10px;') +'position:fixed;z-index:2147483000;pointer-events:none;' +
      'font:500 11px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.02em;' +
      'color:#f4f4f5;background:rgba(39,39,42,.78);padding:5px 9px;border-radius:999px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.18);opacity:.85';
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
})();
