import { ConnectorConfig } from '../ConnectorManager';

export function getConnectorDefinition(): ConnectorConfig {
  return {
    id: 'tavily',
    name: 'Tavily',
    type: 'mcp-server',
    description: 'AI-powered web search for research and competitive analysis.',
    icon: '$(search)',
    status: 'unconfigured',
    fields: [
      {
        id: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Paste your Tavily API key',
        helpText: 'Sign up at tavily.com and copy your API key from the dashboard.',
        helpUrl: 'https://tavily.com',
        required: true,
      },
    ],
    mcpServer: {
      command: 'npx',
      args: ['-y', 'tavily-mcp@latest'],
      httpUrl: 'https://mcp.tavily.com/mcp',
      envMapping: {
        apiKey: 'TAVILY_API_KEY',
      },
    },
    examplePrompts: [
      'Research the latest trends in product management tools',
      'Find competitor pricing for project management software',
      'What are best practices for sprint retrospectives?',
      'Search for recent articles about AI in product management',
    ],
    relatedSkills: ['prd-writer', 'competitive-research'],
    relatedGuides: [],
  };
}
