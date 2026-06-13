export type MemoryCategory =
  | 'company-overview'
  | 'offers-and-pricing'
  | 'icp-and-buyer-psychology'
  | 'sales-scripts-and-objections'
  | 'dm-frameworks'
  | 'client-delivery-sops'
  | 'case-studies-and-proof'
  | 'content-voice-and-examples'
  | 'proposals-and-growth-plans'
  | 'transcripts-and-call-notes'
  | 'metrics-and-reports'
  | 'tool-stack-and-workflows'
  | 'governance-rules';

export interface MemoryDocument {
  id: string;
  title: string;
  category: MemoryCategory;
  source: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  document: MemoryDocument;
  score: number;
}
