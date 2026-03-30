import { ConnectorConfig } from '../ConnectorManager';

export function getConnectorDefinition(): ConnectorConfig {
  return {
    id: 'jira',
    name: 'Jira',
    type: 'mcp-server',
    description: 'Read and manage issues, sprints, and boards in Jira.',
    icon: '$(issues)',
    status: 'unconfigured',
    fields: [
      {
        id: 'instanceUrl',
        label: 'Jira Instance URL',
        type: 'url',
        placeholder: 'https://yourteam.atlassian.net',
        helpText: 'Your Atlassian Cloud instance URL.',
        helpUrl: 'https://support.atlassian.com/jira-software-cloud/docs/what-is-jira-software/',
        required: true,
      },
      {
        id: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Paste your Jira API token',
        helpText: 'Create a token at id.atlassian.com/manage-profile/security/api-tokens',
        helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
        required: true,
      },
      {
        id: 'defaultProject',
        label: 'Default Project Key',
        type: 'text',
        placeholder: 'e.g. PROJ',
        helpText: 'Optional default project key for queries.',
        required: false,
      },
    ],
    mcpServer: {
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-jira'],
      envMapping: {
        instanceUrl: 'JIRA_URL',
        apiToken: 'JIRA_API_TOKEN',
      },
    },
    examplePrompts: [
      'Show me all open bugs in the current sprint',
      'Create a new story for user onboarding improvements',
      'What tickets were completed last sprint?',
      'Move PROJ-123 to In Progress',
    ],
    relatedSkills: ['sprint-retro', 'sprint-planning', 'standup-summary', 'idea-triage', 'roadmap-review', 'user-story-breakdown'],
    relatedGuides: ['triage-ideas'],
  };
}
