export type Phase = "discovery" | "inception" | "construction" | "operations";

export type AmbiguityCategory = "scope" | "architecture" | "nfr" | "api_contract" | "data_model";

export interface AmbiguityItem {
  category: AmbiguityCategory;
  description: string;
  whyItMatters: string;
  suggestedOptions?: string[];
}

export interface ClarificationOption {
  id: string; // e.g. "A", "B", "C"
  text: string;
  tradeoff?: string;
}

export interface ClarificationQuestion {
  id: string; // e.g. "Q1"
  question: string;
  context: string;
  options: ClarificationOption[];
  allowsMultiple?: boolean;
}

export interface ClarityAssessment {
  clarityScore: number; // 0–100
  isClear: boolean; // true if score >= 75 and no blocking ambiguities
  prompt: string;
  ambiguities: AmbiguityItem[];
  questions: ClarificationQuestion[];
}

export interface UserDecision {
  questionId: string;
  selectedOptionId: string;
  customText?: string;
  confirmedAt?: string;
}

export interface GateCheckResult {
  phase: Phase;
  status: "pass" | "blocked";
  score: number; // 0–100
  missingPrerequisites: string[];
  blockingQuestions: string[];
  recommendations: string[];
}

export interface AidlcPosition {
  phase: Phase | "transition" | string;
  stage: string;
  activeWorkflow?: string;
  activeHat?: string;
  activeUnit?: string;
  completionStatus?: string;
}

export interface AidlcState {
  schemaVersion: 1;
  updatedAt: string;
  position: AidlcPosition;
  classification?: {
    type: "greenfield" | "brownfield";
    details?: string;
  };
  reverseEngineeringOutputs?: Record<string, string>;
  breadcrumb: string;
  activeDelivery?: string;
  unknowns?: string[];
  currentValidationUnit?: string;
}

export interface OpenQuestionItem {
  id: string | number;
  question: string;
  owner?: string;
  status: "open" | "resolved" | "blocked";
  priority?: "p0" | "p1" | "p2" | "blocking" | "normal";
  resolvedAt?: string;
  resolution?: string;
}

export interface RequirementRecord {
  id: string;
  topic: string;
  questionId: string;
  decision: string;
  rationale?: string;
  confirmedAt: string;
}

export interface FrozenRequirements {
  schemaVersion: 1;
  updatedAt: string;
  requirements: RequirementRecord[];
}
