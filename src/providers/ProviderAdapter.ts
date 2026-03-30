export interface McpServerDefinition {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerDefinition>;
}

export interface ProviderAdapter {
  readonly provider: string;

  /** Check if this provider's extension is installed and active. */
  detect(): Promise<boolean>;

  /** Path to the global (user-level) MCP config file. */
  getGlobalMcpConfigPath(): string;

  /** Path to the project-level MCP config file. */
  getProjectMcpConfigPath(workspaceRoot: string): string;

  /** Read and parse MCP config from a file path. Returns empty config if file missing. */
  readMcpConfig(configPath: string): Promise<McpConfig>;

  /** Write MCP config to a file path, merging with existing content. */
  writeMcpConfig(configPath: string, config: McpConfig): Promise<void>;

  /** Inject a prompt into the provider's chat input. */
  injectPrompt(text: string): Promise<void>;
}
