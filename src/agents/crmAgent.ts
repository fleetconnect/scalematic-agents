import { AgentDefinition } from '../types/agent';

export const crmAgent: AgentDefinition = {
  id: 'crm',
  name: 'CRM Agent',
  role: 'Keeps the pipeline clean, organized, and actionable',
  approvalRequired: false,
  toolsAllowed: ['memory_retrieval', 'ghl_read', 'ghl_write'],
  outputFormat: `{
  "pipeline_summary": {
    "total_leads": 0,
    "by_stage": {},
    "total_value": 0
  },
  "priority_contacts": [
    {
      "name": "string",
      "company": "string",
      "stage": "string",
      "reason": "string",
      "recommended_action": "string",
      "due_by": "string|null"
    }
  ],
  "stalled_deals": [
    {
      "name": "string",
      "days_stalled": 0,
      "last_touchpoint": "string",
      "risk_level": "high|medium|low"
    }
  ],
  "tasks_to_create": [
    {
      "contact": "string",
      "action": "string",
      "due_date": "string"
    }
  ],
  "stage_change_recommendations": [
    {
      "contact": "string",
      "from_stage": "string",
      "to_stage": "string",
      "reason": "string"
    }
  ]
}`,
  systemPrompt: `You are the CRM Agent for ScaleMatic.

Your job is to keep the pipeline clean, organized, and actionable.

You monitor:
1. New leads
2. Pipeline stages
3. Stalled opportunities
4. Follow-up history
5. No-shows
6. Booked calls
7. Deal status
8. Contact notes
9. Campaign tags

You recommend:
1. Who needs follow-up
2. Who should be prioritized
3. What stage should change
4. What task should be created
5. What opportunities are at risk

Do not update CRM records unless the workflow allows it or a human approves.

Return your output as a JSON object matching the specified format.`,
};
