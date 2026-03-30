import { ConnectorConfig } from '../ConnectorManager';

export function getConnectorDefinition(): ConnectorConfig {
  return {
    id: 'github',
    name: 'GitHub',
    type: 'cli-tool',
    description: 'Access PRs, issues, repo info, and code search via the GitHub CLI.',
    icon: '$(github)',
    status: 'unconfigured',
    fields: [],
    cliTool: {
      command: 'gh',
      authCommand: 'gh auth login',
      statusCommand: 'gh auth status',
    },
    examplePrompts: [
      'List open pull requests in this repo',
      'Show me issues labeled "bug"',
      'Create a PR from the current branch',
      'What changed in the last 5 commits?',
    ],
    relatedSkills: ['sprint-retro', 'standup-summary'],
    relatedGuides: ['sharing-product-context'],
  };
}
