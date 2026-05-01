import { describe, it, expect } from 'vitest';
import { getConnectorDefinition as jiraDef } from '../../src/connectors/adapters/JiraAdapter';
import { getConnectorDefinition as githubDef } from '../../src/connectors/adapters/GitHubAdapter';
import { getConnectorDefinition as mondayDef } from '../../src/connectors/adapters/MondayAdapter';
import { getConnectorDefinition as ahaDef } from '../../src/connectors/adapters/AhaAdapter';
import { getConnectorDefinition as tavilyDef } from '../../src/connectors/adapters/TavilyAdapter';
import type { ConnectorConfig } from '../../src/connectors/ConnectorManager';

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertValidConnectorConfig(config: ConnectorConfig) {
  expect(config.id).toBeTruthy();
  expect(config.name).toBeTruthy();
  expect(['mcp-server', 'cli-tool', 'rest-api']).toContain(config.type);
  expect(config.description).toBeTruthy();
  expect(config.icon).toBeTruthy();
  expect(config.examplePrompts.length).toBeGreaterThan(0);
  expect(Array.isArray(config.relatedSkills)).toBe(true);
  expect(Array.isArray(config.relatedGuides)).toBe(true);
}

// ── Jira Adapter ─────────────────────────────────────────────────────────────

describe('JiraAdapter', () => {
  const def = jiraDef();

  it('returns a valid ConnectorConfig', () => {
    assertValidConnectorConfig(def);
  });

  it('has id "jira"', () => {
    expect(def.id).toBe('jira');
  });

  it('type is mcp-server', () => {
    expect(def.type).toBe('mcp-server');
  });

  it('has instanceUrl, apiToken, and defaultProject fields', () => {
    const fieldIds = def.fields.map((f) => f.id);
    expect(fieldIds).toContain('instanceUrl');
    expect(fieldIds).toContain('apiToken');
    expect(fieldIds).toContain('defaultProject');
  });

  it('apiToken field is a password type', () => {
    const apiTokenField = def.fields.find((f) => f.id === 'apiToken');
    expect(apiTokenField?.type).toBe('password');
  });

  it('instanceUrl field is a url type', () => {
    const urlField = def.fields.find((f) => f.id === 'instanceUrl');
    expect(urlField?.type).toBe('url');
  });

  it('has non-empty examplePrompts', () => {
    expect(def.examplePrompts.length).toBeGreaterThan(0);
    for (const prompt of def.examplePrompts) {
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it('status defaults to unconfigured', () => {
    expect(def.status).toBe('unconfigured');
  });

  it('has mcpServer with correct command and args', () => {
    expect(def.mcpServer).toBeDefined();
    expect(def.mcpServer!.command).toBe('npx');
    expect(def.mcpServer!.args).toContain('-y');
    expect(def.mcpServer!.args).toContain('mcp-server-jira-cloud');
    expect(def.mcpServer!.httpUrl).toBe('https://mcp.atlassian.com/v1/mcp');
  });

  it('mcpServer envMapping maps fields to env vars', () => {
    expect(def.mcpServer!.envMapping).toEqual({
      instanceUrl: 'JIRA_URL',
      apiToken: 'JIRA_API_TOKEN',
    });
  });
});

// ── GitHub Adapter ───────────────────────────────────────────────────────────

describe('GitHubAdapter', () => {
  const def = githubDef();

  it('returns a valid ConnectorConfig', () => {
    assertValidConnectorConfig(def);
  });

  it('has id "github"', () => {
    expect(def.id).toBe('github');
  });

  it('type is cli-tool', () => {
    expect(def.type).toBe('cli-tool');
  });

  it('has no form fields', () => {
    expect(def.fields).toHaveLength(0);
  });

  it('has a statusCommand', () => {
    expect(def.cliTool).toBeDefined();
    expect(def.cliTool!.statusCommand).toBe('gh auth status');
  });

  it('has no mcpServer definition', () => {
    expect(def.mcpServer).toBeUndefined();
  });

  it('has non-empty examplePrompts', () => {
    expect(def.examplePrompts.length).toBeGreaterThan(0);
  });

  it('status defaults to unconfigured', () => {
    expect(def.status).toBe('unconfigured');
  });
});

// ── Monday Adapter ───────────────────────────────────────────────────────────

describe('MondayAdapter', () => {
  const def = mondayDef();

  it('returns a valid ConnectorConfig', () => {
    assertValidConnectorConfig(def);
  });

  it('has id "monday"', () => {
    expect(def.id).toBe('monday');
  });

  it('type is mcp-server', () => {
    expect(def.type).toBe('mcp-server');
  });

  it('has apiToken field', () => {
    const fieldIds = def.fields.map((f) => f.id);
    expect(fieldIds).toContain('apiToken');
  });

  it('apiToken field is a password type', () => {
    const apiTokenField = def.fields.find((f) => f.id === 'apiToken');
    expect(apiTokenField?.type).toBe('password');
    expect(apiTokenField?.required).toBe(true);
  });

  it('has non-empty examplePrompts', () => {
    expect(def.examplePrompts.length).toBeGreaterThan(0);
  });

  it('status defaults to unconfigured', () => {
    expect(def.status).toBe('unconfigured');
  });

  it('has mcpServer with correct command and args', () => {
    expect(def.mcpServer).toBeDefined();
    expect(def.mcpServer!.command).toBe('npx');
    expect(def.mcpServer!.args).toContain('@mondaydotcomorg/monday-api-mcp');
    expect(def.mcpServer!.httpUrl).toBe('https://mcp.monday.com/mcp');
  });

  it('mcpServer envMapping maps apiToken', () => {
    expect(def.mcpServer!.envMapping).toEqual({
      apiToken: 'MONDAY_API_TOKEN',
    });
  });
});

// ── Aha Adapter ──────────────────────────────────────────────────────────────

describe('AhaAdapter', () => {
  const def = ahaDef();

  it('returns a valid ConnectorConfig', () => {
    assertValidConnectorConfig(def);
  });

  it('has id "aha"', () => {
    expect(def.id).toBe('aha');
  });

  it('type is mcp-server', () => {
    expect(def.type).toBe('mcp-server');
  });

  it('has instanceUrl and apiToken fields', () => {
    const fieldIds = def.fields.map((f) => f.id);
    expect(fieldIds).toContain('instanceUrl');
    expect(fieldIds).toContain('apiToken');
  });

  it('apiToken field is a password type', () => {
    const apiTokenField = def.fields.find((f) => f.id === 'apiToken');
    expect(apiTokenField?.type).toBe('password');
    expect(apiTokenField?.required).toBe(true);
  });

  it('instanceUrl field is a url type', () => {
    const urlField = def.fields.find((f) => f.id === 'instanceUrl');
    expect(urlField?.type).toBe('url');
    expect(urlField?.required).toBe(true);
  });

  it('has non-empty examplePrompts', () => {
    expect(def.examplePrompts.length).toBeGreaterThan(0);
  });

  it('status defaults to unconfigured', () => {
    expect(def.status).toBe('unconfigured');
  });

  it('has mcpServer with correct command and args', () => {
    expect(def.mcpServer).toBeDefined();
    expect(def.mcpServer!.command).toBe('npx');
    expect(def.mcpServer!.args).toContain('aha-mcp@latest');
  });

  it('mcpServer envMapping maps both fields', () => {
    expect(def.mcpServer!.envMapping).toEqual({
      instanceUrl: 'AHA_DOMAIN',
      apiToken: 'AHA_API_TOKEN',
    });
  });
});

// ── Tavily Adapter ───────────────────────────────────────────────────────────

describe('TavilyAdapter', () => {
  const def = tavilyDef();

  it('returns a valid ConnectorConfig', () => {
    assertValidConnectorConfig(def);
  });

  it('has id "tavily"', () => {
    expect(def.id).toBe('tavily');
  });

  it('type is mcp-server', () => {
    expect(def.type).toBe('mcp-server');
  });

  it('has a single apiKey field', () => {
    expect(def.fields).toHaveLength(1);
    expect(def.fields[0].id).toBe('apiKey');
  });

  it('apiKey field is a password type', () => {
    expect(def.fields[0].type).toBe('password');
    expect(def.fields[0].required).toBe(true);
  });

  it('has non-empty examplePrompts', () => {
    expect(def.examplePrompts.length).toBeGreaterThan(0);
  });

  it('status defaults to unconfigured', () => {
    expect(def.status).toBe('unconfigured');
  });

  it('has mcpServer with correct command and args', () => {
    expect(def.mcpServer).toBeDefined();
    expect(def.mcpServer!.command).toBe('npx');
    expect(def.mcpServer!.args).toContain('tavily-mcp@latest');
    expect(def.mcpServer!.httpUrl).toBe('https://mcp.tavily.com/mcp');
  });

  it('mcpServer envMapping maps apiKey', () => {
    expect(def.mcpServer!.envMapping).toEqual({
      apiKey: 'TAVILY_API_KEY',
    });
  });
});
