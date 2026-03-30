import { ConnectorConfig } from '../ConnectorManager';

export function getConnectorDefinition(): ConnectorConfig {
  return {
    id: 'monday',
    name: 'Monday',
    type: 'mcp-server',
    description: 'Manage boards, items, and updates in Monday.com.',
    icon: '$(checklist)',
    status: 'unconfigured',
    fields: [
      {
        id: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Paste your Monday.com API token',
        helpText: 'Find your token under Monday.com > Avatar > Developers > My Access Tokens.',
        helpUrl: 'https://support.monday.com/hc/en-us/articles/360005144659-Does-monday-com-have-an-API',
        required: true,
      },
    ],
    mcpServer: {
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-monday'],
      envMapping: {
        apiToken: 'MONDAY_API_TOKEN',
      },
    },
    examplePrompts: [
      'Show me all items on the Sprint Board',
      'Create a new item in the Backlog group',
      'What updates were posted this week?',
      'Move item to Done status',
    ],
    relatedSkills: ['idea-triage', 'sprint-planning', 'user-story-breakdown'],
    relatedGuides: ['triage-ideas'],
  };
}
