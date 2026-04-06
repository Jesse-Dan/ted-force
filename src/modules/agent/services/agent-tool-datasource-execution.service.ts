import { Autowired, Service } from "fragment-ts";
import mysql from "mysql2/promise";
import type { DataSourceConnection } from "../../../entities/data-source-connection.entity";
import { DataSourceType } from "../../../entities/enums/data-source-type.enum";
import { DataSourceRepository } from "../../data_source/repositories/data-source.repository";

const { Client: PostgresClient } = require("pg") as {
  Client: new (config: Record<string, unknown>) => {
    connect(): Promise<void>;
    query(query: string): Promise<{ rows: unknown[] }>;
    end(): Promise<void>;
  };
};

type ConfigField<T> = {
  type?: string;
  value?: T;
};

function unwrapConfigValue<T>(input: unknown): T | undefined {
  if (input && typeof input === "object" && "value" in (input as Record<string, unknown>)) {
    return (input as ConfigField<T>).value;
  }

  return input as T | undefined;
}

@Service()
export class AgentToolDataSourceExecutionService {
  @Autowired()
  private dataSourceRepository!: DataSourceRepository;

  create(agentId: string, dataSourceRef: string) {
    return {
      mysql: () =>
        this.buildTypedAdapter(agentId, dataSourceRef, DataSourceType.MYSQL),
      pgsql: () =>
        this.buildTypedAdapter(agentId, dataSourceRef, DataSourceType.POSTGRES),
      postgres: () =>
        this.buildTypedAdapter(agentId, dataSourceRef, DataSourceType.POSTGRES),
      sql: () => this.buildGenericSqlAdapter(agentId, dataSourceRef),
    };
  }

  private async resolve(agentId: string, dataSourceRef: string): Promise<DataSourceConnection> {
    const sources = await this.dataSourceRepository.findByAgentId(agentId);
    const source = sources.find(
      (entry) => entry.id === dataSourceRef || entry.name === dataSourceRef,
    );

    if (!source) {
      throw new Error(`Datasource "${dataSourceRef}" was not found for this agent.`);
    }

    return source;
  }

  private buildTypedAdapter(
    agentId: string,
    dataSourceRef: string,
    expectedType: DataSourceType,
  ) {
    return {
      query: async <T = unknown>(query: string) =>
        this.executeSql<T>(agentId, dataSourceRef, query, expectedType),
      raw: async <T = unknown>(query: string) =>
        this.executeSql<T>(agentId, dataSourceRef, query, expectedType),
    };
  }

  private buildGenericSqlAdapter(agentId: string, dataSourceRef: string) {
    return {
      query: async <T = unknown>(query: string) =>
        this.executeGenericSql<T>(agentId, dataSourceRef, query),
      raw: async <T = unknown>(query: string) =>
        this.executeGenericSql<T>(agentId, dataSourceRef, query),
    };
  }

  private async executeSql<T>(
    agentId: string,
    dataSourceRef: string,
    query: string,
    expectedType: DataSourceType,
  ): Promise<{ success: true; message: string; data: T }> {
    const source = await this.resolve(agentId, dataSourceRef);

    if (!query?.trim()) {
      throw new Error("A SQL query is required.");
    }

    if (source.type !== expectedType) {
      throw new Error(
        `Datasource "${source.name}" is ${source.type}, not ${expectedType}.`,
      );
    }

    if (source.type === DataSourceType.MYSQL) {
      return this.executeMysql<T>(source, query);
    }

    if (source.type === DataSourceType.POSTGRES) {
      return this.executePostgres<T>(source, query);
    }

    throw new Error(`Datasource type ${source.type} is not supported for SQL execution.`);
  }

  private async executeGenericSql<T>(
    agentId: string,
    dataSourceRef: string,
    query: string,
  ): Promise<{ success: true; message: string; data: T }> {
    const source = await this.resolve(agentId, dataSourceRef);

    if (source.type === DataSourceType.MYSQL) {
      return this.executeMysql<T>(source, query);
    }

    if (source.type === DataSourceType.POSTGRES) {
      return this.executePostgres<T>(source, query);
    }

    throw new Error(
      `Datasource "${source.name}" is not a SQL datasource and cannot be used with sql().`,
    );
  }

  private async executeMysql<T>(
    source: DataSourceConnection,
    query: string,
  ): Promise<{ success: true; message: string; data: T }> {
    const config = this.resolveSqlConfig(source.type, source.config);
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      charset: config.charset,
    });

    try {
      const [rows] = await connection.query(query);

      return {
        success: true,
        message: `Successfully ran query on MySQL datasource "${source.name}".`,
        data: rows as T,
      };
    } finally {
      await connection.end();
    }
  }

  private async executePostgres<T>(
    source: DataSourceConnection,
    query: string,
  ): Promise<{ success: true; message: string; data: T }> {
    const config = this.resolveSqlConfig(source.type, source.config);
    const client = new PostgresClient({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl:
        config.ssl === undefined
          ? undefined
          : config.ssl
            ? { rejectUnauthorized: false }
            : false,
    });

    await client.connect();

    try {
      const result = await client.query(query);

      return {
        success: true,
        message: `Successfully ran query on Postgres datasource "${source.name}".`,
        data: result.rows as T,
      };
    } finally {
      await client.end();
    }
  }

  private resolveSqlConfig(
    sourceType: DataSourceType,
    config: Record<string, unknown> | null | undefined,
  ): {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    charset?: string;
    ssl?: boolean;
  } {
    const host = unwrapConfigValue<string>(config?.host);
    const database = unwrapConfigValue<string>(config?.database);
    const username = unwrapConfigValue<string>(config?.username);
    const password = unwrapConfigValue<string>(config?.password);
    const charset = unwrapConfigValue<string>(config?.charset);
    const ssl = unwrapConfigValue<boolean>(config?.ssl);
    const rawPort = unwrapConfigValue<number | string>(config?.port);
    const port = rawPort === undefined ? undefined : Number(rawPort);

    if (!host || !database || !username || !password) {
      throw new Error("Datasource config is incomplete. Expected host, database, username, and password.");
    }

    if (port !== undefined && Number.isNaN(port)) {
      throw new Error("Datasource port must be a valid number.");
    }

    return {
      host,
      port: port ?? (sourceType === DataSourceType.MYSQL ? 3306 : 5432),
      database,
      username,
      password,
      charset,
      ssl,
    };
  }
}
