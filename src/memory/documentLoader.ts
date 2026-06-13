import fs from 'fs';
import path from 'path';
import { MemoryCategory } from '../types/memory';
import { upsertMemoryDocument } from './vectorStore';
import { logger } from '../utils/logger';

const BRAIN_DIR = path.join(__dirname, '../../scalematic-brain');

const CATEGORY_MAP: Record<string, MemoryCategory> = {
  'company-overview': 'company-overview',
  'offers-and-pricing': 'offers-and-pricing',
  'icp-and-buyer-psychology': 'icp-and-buyer-psychology',
  'sales-scripts-and-objections': 'sales-scripts-and-objections',
  'dm-frameworks': 'dm-frameworks',
  'client-delivery-sops': 'client-delivery-sops',
  'case-studies-and-proof': 'case-studies-and-proof',
  'content-voice-and-examples': 'content-voice-and-examples',
  'proposals-and-growth-plans': 'proposals-and-growth-plans',
  'transcripts-and-call-notes': 'transcripts-and-call-notes',
  'metrics-and-reports': 'metrics-and-reports',
  'tool-stack-and-workflows': 'tool-stack-and-workflows',
  'governance-rules': 'governance-rules',
};

export function loadBrainDocuments(): number {
  if (!fs.existsSync(BRAIN_DIR)) {
    logger.warn('scalematic-brain directory not found — skipping document load');
    return 0;
  }

  let count = 0;
  const folders = fs.readdirSync(BRAIN_DIR);

  for (const folder of folders) {
    const category = CATEGORY_MAP[folder];
    if (!category) continue;

    const folderPath = path.join(BRAIN_DIR, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.md') || f.endsWith('.txt'));
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const title = path.basename(file, path.extname(file)).replace(/-/g, ' ');
      upsertMemoryDocument(title, category, filePath, content);
      count++;
    }
  }

  logger.info(`Loaded ${count} documents from scalematic-brain`);
  return count;
}
