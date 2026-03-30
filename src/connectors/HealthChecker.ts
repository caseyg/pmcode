import { ConnectorManager, ConnectorConfig, ConnectorStatus } from './ConnectorManager';

export interface HealthCheckResult {
  status: ConnectorStatus;
  message: string;
}

/**
 * Runs health checks against all registered connectors.
 *
 * For MCP servers: verifies required credentials are present and the
 * command is available (or reachable via npx).
 *
 * For CLI tools: runs the status command and parses the output.
 */
export class HealthChecker {
  private connectorManager: ConnectorManager;

  constructor(connectorManager: ConnectorManager) {
    this.connectorManager = connectorManager;
  }

  /**
   * Run health checks on every connector and return a map of id -> status.
   */
  async checkAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const connectors = await this.connectorManager.getConnectors();

    for (const connector of connectors) {
      const result = await this.check(connector.id);
      results.set(connector.id, result);
    }

    return results;
  }

  /**
   * Run a health check for a single connector.
   */
  async check(id: string): Promise<HealthCheckResult> {
    const connector = await this.connectorManager.getConnector(id);
    if (!connector) {
      return { status: 'error', message: `Unknown connector: ${id}` };
    }

    // If the connector is disabled, report that without probing
    if (connector.status === 'disabled') {
      return { status: 'disabled', message: `${connector.name} is disabled.` };
    }

    // If unconfigured, report that
    if (connector.status === 'unconfigured') {
      return { status: 'unconfigured', message: `${connector.name} has not been configured yet.` };
    }

    // For configured connectors, run the live test
    return this.connectorManager.testConnection(id);
  }
}
