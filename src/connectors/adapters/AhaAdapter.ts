import { ConnectorConfig } from '../ConnectorManager';

export function getConnectorDefinition(): ConnectorConfig {
  return {
    id: 'aha',
    name: 'Aha!',
    type: 'mcp-server',
    description: 'Access roadmaps, ideas, features, and releases in Aha!.',
    icon: '$(lightbulb)',
    status: 'unconfigured',
    fields: [
      {
        id: 'instanceUrl',
        label: 'Aha! Instance URL',
        type: 'url',
        placeholder: 'https://yourcompany.aha.io',
        helpText: 'Your Aha! account URL.',
        helpUrl: 'https://www.aha.io/support',
        required: true,
      },
      {
        id: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Paste your Aha! API token',
        helpText: 'Generate a token under Settings > Personal > Developer > API Key.',
        helpUrl: 'https://www.aha.io/api',
        required: true,
      },
    ],
    mcpServer: {
      command: 'npx',
      args: ['-y', 'aha-mcp@latest'],
      envMapping: {
        instanceUrl: 'AHA_DOMAIN',
        apiToken: 'AHA_API_TOKEN',
      },
    },
    examplePrompts: [
      'Show me the current product roadmap',
      'List recent ideas submitted this month',
      'What features are planned for next release?',
      'Summarize the status of release 2.0',
    ],
    relatedSkills: ['idea-triage', 'roadmap-review'],
    relatedGuides: ['triage-ideas'],
  };
}
