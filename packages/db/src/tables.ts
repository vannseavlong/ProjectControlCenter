import type {
  CreateOptions,
  DeleteOptions,
  FindOptions,
  UpdateOptions,
  UpsertOptions,
} from "longcelot-sheet-db";
import type { Agent, Command, PingLog, Project, SettingRow } from "@pcc/types";
import { getAdminContext } from "./adapter";

/** Same shape as lsdb's TableOperations, but typed to a row shape instead of Record<string, unknown>. */
export interface TypedTable<T extends object> {
  create(data: Partial<T>, options?: CreateOptions): Promise<T>;
  createMany(records: Partial<T>[], options?: CreateOptions): Promise<T[]>;
  findMany(options?: FindOptions): Promise<T[]>;
  findOne(options?: FindOptions): Promise<T | null>;
  update(options: UpdateOptions): Promise<number>;
  upsert(options: UpsertOptions): Promise<T>;
  delete(options: DeleteOptions): Promise<number>;
  count(options?: Pick<FindOptions, "where" | "includeDeleted">): Promise<number>;
}

function typedTable<T extends object>(tableName: string): TypedTable<T> {
  return getAdminContext().table(tableName) as unknown as TypedTable<T>;
}

/** Typed table helpers — the only way apps/web and apps/agent-bridge should touch table data. */
export const projectsTable = (): TypedTable<Project> => typedTable<Project>("projects");
export const agentsTable = (): TypedTable<Agent> => typedTable<Agent>("agents");
export const pingLogsTable = (): TypedTable<PingLog> => typedTable<PingLog>("ping_logs");
export const commandQueueTable = (): TypedTable<Command> => typedTable<Command>("command_queue");
export const settingsTable = (): TypedTable<SettingRow> => typedTable<SettingRow>("settings");
