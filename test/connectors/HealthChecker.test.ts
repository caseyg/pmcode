import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthChecker } from '../../src/connectors/HealthChecker';
import type { ConnectorManager, ConnectorConfig, ConnectorStatus } from '../../src/connectors/ConnectorManager';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConnector(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: 'test',
    name: 'Test Connector',
    type: 'mcp-server',
    description: 'A test connector',
    icon: '$(test)',
    status: 'unconfigured',
    fields: [],
    examplePrompts: ['test prompt'],
    relatedSkills: [],
    relatedGuides: [],
    ...overrides,
  };
}

function createMockConnectorManager(connectors: ConnectorConfig[]): ConnectorManager {
  const connectorMap = new Map(connectors.map((c) => [c.id, c]));

  return {
    getConnectors: vi.fn(async () => connectors),
    getConnector: vi.fn(async (id: string) => connectorMap.get(id)),
    testConnection: vi.fn(async (id: string) => {
      const c = connectorMap.get(id);
      if (!c) {
        return { status: 'error' as ConnectorStatus, message: `Unknown connector: ${id}` };
      }
      return { status: 'connected' as ConnectorStatus, message: `${c.name} is connected.` };
    }),
  } as unknown as ConnectorManager;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HealthChecker', () => {
  let mockManager: ConnectorManager;
  let checker: HealthChecker;

  const jira = makeConnector({ id: 'jira', name: 'Jira', status: 'connected' });
  const github = makeConnector({ id: 'github', name: 'GitHub', type: 'cli-tool', status: 'connected' });
  const monday = makeConnector({ id: 'monday', name: 'Monday', status: 'unconfigured' });
  const aha = makeConnector({ id: 'aha', name: 'Aha!', status: 'disabled' });
  const tavily = makeConnector({ id: 'tavily', name: 'Tavily', status: 'connected' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockManager = createMockConnectorManager([jira, github, monday, aha, tavily]);
    checker = new HealthChecker(mockManager);
  });

  // ── checkAll ─────────────────────────────────────────────────────────────

  describe('checkAll()', () => {
    it('returns status for all connectors', async () => {
      const results = await checker.checkAll();
      expect(results.size).toBe(5);
      expect(results.has('jira')).toBe(true);
      expect(results.has('github')).toBe(true);
      expect(results.has('monday')).toBe(true);
      expect(results.has('aha')).toBe(true);
      expect(results.has('tavily')).toBe(true);
    });

    it('calls getConnectors to enumerate all connectors', async () => {
      await checker.checkAll();
      expect(mockManager.getConnectors).toHaveBeenCalledOnce();
    });
  });

  // ── check ────────────────────────────────────────────────────────────────

  describe('check()', () => {
    it('returns status for a specific connector', async () => {
      const result = await checker.check('jira');
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('returns unconfigured for unconfigured connectors', async () => {
      const result = await checker.check('monday');
      expect(result.status).toBe('unconfigured');
      expect(result.message).toContain('Monday');
      expect(result.message).toContain('not been configured');
    });

    it('returns disabled for disabled connectors', async () => {
      const result = await checker.check('aha');
      expect(result.status).toBe('disabled');
      expect(result.message).toContain('Aha!');
      expect(result.message).toContain('disabled');
    });

    it('returns connected for healthy configured connectors', async () => {
      const result = await checker.check('jira');
      expect(result.status).toBe('connected');
    });

    it('calls testConnection for configured connectors', async () => {
      await checker.check('jira');
      expect(mockManager.testConnection).toHaveBeenCalledWith('jira');
    });

    it('does not call testConnection for unconfigured connectors', async () => {
      await checker.check('monday');
      expect(mockManager.testConnection).not.toHaveBeenCalled();
    });

    it('does not call testConnection for disabled connectors', async () => {
      await checker.check('aha');
      expect(mockManager.testConnection).not.toHaveBeenCalled();
    });

    it('returns error for unknown connector', async () => {
      const result = await checker.check('nonexistent');
      expect(result.status).toBe('error');
      expect(result.message).toContain('Unknown connector');
    });

    it('returns error when testConnection fails', async () => {
      vi.mocked(mockManager.testConnection).mockResolvedValueOnce({
        status: 'error',
        message: 'Connection refused',
      });

      const result = await checker.check('jira');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Connection refused');
    });

    it('handles unexpected errors gracefully', async () => {
      vi.mocked(mockManager.getConnector).mockRejectedValueOnce(new Error('Timeout'));

      // The error will propagate; the checker doesn't have internal try/catch
      // for getConnector, so we verify it rejects
      await expect(checker.check('jira')).rejects.toThrow('Timeout');
    });
  });
});
