// Modèles de données partagés avec le backend .NET.
// Toute évolution ici doit être reportée dans API_CONTRACT.md.

export type Locale = 'fr' | 'en';

export type Role = 'AGENT' | 'AUDITEUR' | 'ADMIN';

export type ScopeCode =
  | 'MAINTENANCE'
  | 'TRANSPORT'
  | 'RH'
  | 'JURIDIQUE'
  | 'FINANCE'
  | 'COMMERCIAL';

export interface Scope {
  code: ScopeCode | string;
  label: string;
}

export interface AgentProfile {
  id: string;
  matricule: string;
  fullName: string;
  email?: string;
  grade: number;
  gradeLabel: string;
  department: string;
  departmentLabel: string;
  roles: Role[];
  allowedCategories: string[];
  locale: Locale;
  transparencyAccepted: boolean;
  defaultScopes?: string[];
  lastLoginAt?: string;
}

export interface LoginResponse {
  accessToken?: string;
  expiresAt?: string;
  user: AgentProfile;
}

export type ModelTier = 'light' | 'reasoning';

export interface ModelInfo {
  id: string;
  label: string;
  tier: ModelTier;
}

/** Granularité du segment indexé (parent-child chunking + TATR + GraphRAG). */
export type ChunkType = 'short' | 'long' | 'cell' | 'image_caption' | 'graph_summary';

export interface Citation {
  id: string;
  documentId: string;
  documentTitle: string;
  section?: string | null;
  article?: string | null;
  page?: number | null;
  excerpt?: string | null;
  score?: number | null;
  category?: string | null;
  chunkType?: ChunkType | null;
  /** Document remplacé par une version ultérieure : la citation reste traçable. */
  superseded?: boolean | null;
}

export type RefusalReason =
  | 'low_faithfulness'
  | 'low_confidence'
  | 'out_of_scope'
  | 'not_authorised';

export interface Refusal {
  reason: RefusalReason;
  faithfulness?: number | null;
  confidence?: number | null;
  message?: string | null;
  /**
   * Références des passages les plus proches trouvés dans le corpus.
   * Elles guident l'agent vers les sources pertinentes sans lui fournir
   * une réponse dont la fidélité n'est pas établie.
   */
  nearestSources?: Citation[] | null;
}

/** Les quatre métriques RAGAS calculées par réponse. */
export interface RagasScores {
  faithfulness?: number | null;
  answerRelevancy?: number | null;
  contextPrecision?: number | null;
  contextRecall?: number | null;
}

/**
 * Vérification secondaire déclenchée sur les requêtes critiques
 * (procédures de sécurité, obligations réglementaires à risque).
 * La trace de raisonnement n'est exposée qu'aux administrateurs.
 */
export interface CriticalVerification {
  model: string;
  verdict: 'confirmed' | 'flagged';
  trace?: string | null;
}

export type PipelineStage =
  | 'hyde'
  | 'retrieval'
  | 'fusion'
  | 'rerank'
  | 'graph'
  | 'reformulation'
  | 'generation'
  | 'validation';

/**
 * Classe de requête déterminée par l'évaluateur de complexité.
 * `single_hop` : information dans un seul passage (modèle léger, 4–5 s).
 * `multi_hop` : preuves distribuées, parcours GraphRAG (raisonnement, 14–15 s).
 */
export type QueryClass = 'single_hop' | 'multi_hop';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: ModelInfo | null;
  faithfulness?: number | null;
  confidence?: number | null;
  latencyMs?: number | null;
  iterations?: number | null;
  refusal?: Refusal | null;
  queryClass?: QueryClass | null;
  ragas?: RagasScores | null;
  criticalVerification?: CriticalVerification | null;
  /**
   * Le modèle de raisonnement était indisponible : la réponse a été produite
   * par le modèle léger. L'agent en est averti explicitement.
   */
  modelFallback?: boolean | null;
  citations?: Citation[];
  /** État transitoire côté client pendant la génération SSE. */
  streaming?: boolean;
  stage?: PipelineStage | null;
  error?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  scopes: string[];
}

export interface ConversationDetail extends Omit<Conversation, 'messageCount'> {
  messageCount?: number;
  messages: ChatMessage[];
}

export type IngestionStatus =
  | 'pending'
  | 'ocr'
  | 'correction'
  | 'chunking'
  | 'embedding'
  | 'indexed'
  | 'failed';

export interface IngestionStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  finishedAt?: string | null;
}

export interface DocumentItem {
  id: string;
  title: string;
  reference: string;
  category: string;
  /** Nature normative du document, héritée de la taxonomie KALATI. */
  documentClass?: 'IGS' | 'CONVENTION' | 'CIRCULAIRE_RH' | 'PROCEDURE' | 'BLOCK' | 'RAPPORT';
  department: string;
  gradeMin: number;
  pageCount: number;
  sourceType: 'scan' | 'native_pdf';
  ocrEngine?: 'paddleocr-vl' | 'glm-ocr' | null;
  stamped: boolean;
  status: IngestionStatus;
  chunkCount: number;
  indexedAt?: string | null;
  updatedAt: string;
  /** Cycle de vie documentaire : un texte remplacé n'alimente plus les réponses. */
  lifecycle?: 'active' | 'superseded';
  supersededBy?: string | null;
  version?: string | null;
  effectiveDate?: string | null;
  hasTables?: boolean;
}

export interface DocumentDetail extends DocumentItem {
  ingestion: {
    status: IngestionStatus;
    steps: IngestionStep[];
    errorMessage?: string | null;
  };
}

export interface DocumentPage {
  page: number;
  text: string;
  imageUrl?: string | null;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  agentHash: string;
  grade: number;
  department: string;
  questionHash: string;
  answerHash: string;
  rbacFilter: string;
  retrievedCount: number;
  keptCount: number;
  model: string;
  confidence: number;
  faithfulness: number;
  outcome: 'answered' | 'refused' | 'error';
  latencyMs: number;
  prevHash: string;
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  checkedCount: number;
  firstInvalidId?: number | null;
  verifiedAt: string;
}

export interface Grade {
  id?: string;
  level: number;
  label: string;
}

export interface Department {
  id?: string;
  code: string;
  label: string;
}

export interface Category {
  id?: string;
  code: string;
  label: string;
  gradeMin: number;
}

export interface AdminAgent {
  id: string;
  matricule: string;
  fullName: string;
  email?: string;
  grade: number;
  department: string;
  roles: Role[];
  allowedCategories: string[];
  enabled: boolean;
  lastLoginAt?: string | null;
}

export interface Metric {
  value: number;
  delta: number;
}

export interface MetricsOverview {
  questions: Metric;
  answerRate: Metric;
  refusalRate: Metric;
  avgFaithfulness: Metric;
  avgConfidence: Metric;
  avgLatencyMs: Metric;
  modelSplit: { light: number; reasoning: number };
  indexedDocuments: Metric;
  activeAgents: Metric;
  /** Moyennes RAGAS sur la période. */
  ragas?: {
    faithfulness: Metric;
    answerRelevancy: Metric;
    contextPrecision: Metric;
    contextRecall: Metric;
  };
}

/** Une évaluation hebdomadaire du golden dataset. */
export interface QualityRun {
  id: string;
  runAt: string;
  trigger: 'scheduled' | 'corpus_update' | 'pipeline_update';
  questionCount: number;
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall: number;
  /** Divergence RAGAS / ARES au-delà de 0,05 : révision humaine requise. */
  aresDivergence?: number | null;
  status: 'passed' | 'review_required' | 'failed';
}

export interface TimeSeries {
  metric: string;
  unit: string;
  points: { t: string; v: number }[];
}

export interface ScopeMetric {
  code: string;
  questions: number;
  refusalRate: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  components: Record<string, string>;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
