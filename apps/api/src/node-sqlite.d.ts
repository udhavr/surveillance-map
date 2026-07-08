declare module 'node:sqlite' {
    export type RunResult = {
        changes: number
        lastInsertRowid: number | bigint
    }

    export class StatementSync {
        all(...values: unknown[]): unknown[]
        get(...values: unknown[]): unknown
        run(...values: unknown[]): RunResult
    }

    export class DatabaseSync {
        constructor(filename: string)
        close(): void
        exec(sql: string): void
        prepare(sql: string): StatementSync
    }
}
