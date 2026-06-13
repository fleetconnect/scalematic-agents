export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class ApprovalRequiredError extends Error {
  public readonly approvalId: string;
  constructor(approvalId: string) {
    super(`Human approval required. Approval ID: ${approvalId}`);
    this.name = 'ApprovalRequiredError';
    this.approvalId = approvalId;
  }
}

export class IntegrationError extends Error {
  constructor(integration: string, message: string) {
    super(`[${integration}] ${message}`);
    this.name = 'IntegrationError';
  }
}
