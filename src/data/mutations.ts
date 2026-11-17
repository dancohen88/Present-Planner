// Every PlannerAction becomes exactly one database write. toMutation is pure:
// it describes the write as plain data, so each action's mapping can be
// unit-tested without a database. runMutation is the thin part that sends it.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlannerAction } from '../domain/planner.ts'
import type { Database, TablesInsert, TablesUpdate } from './database.types.ts'
import { giftToRow, personToRow, purchaserToRow } from './rows.ts'

export type PlanTable = 'people' | 'purchasers' | 'gifts'

/**
 * One write against one table. The mapped type ties `values` to the table:
 * an insert into 'gifts' must carry gift columns. (Mapping over the table
 * names and then indexing with them turns this into a union of per-table
 * shapes.)
 */
export type Mutation = {
  [T in PlanTable]:
    | { table: T; op: 'insert'; values: TablesInsert<T> }
    | { table: T; op: 'update'; id: string; values: TablesUpdate<T> }
    | { table: T; op: 'delete'; id: string }
}[PlanTable]

export function toMutation(action: PlannerAction, planId: string): Mutation {
  switch (action.type) {
    case 'personAdded':
      return {
        table: 'people',
        op: 'insert',
        values: personToRow(action.person, planId),
      }
    case 'personRemoved':
      // The database removes their gifts too (on delete cascade), just as
      // the reducer does.
      return { table: 'people', op: 'delete', id: action.personId }
    case 'budgetSet':
      return {
        table: 'people',
        op: 'update',
        id: action.personId,
        values: { budget_pence: action.budgetPence },
      }
    case 'purchaserAdded':
      return {
        table: 'purchasers',
        op: 'insert',
        values: purchaserToRow(action.purchaser, planId),
      }
    case 'purchaserRemoved':
      // The database unassigns their gifts (on delete set null).
      return { table: 'purchasers', op: 'delete', id: action.purchaserId }
    case 'giftAdded':
      return {
        table: 'gifts',
        op: 'insert',
        values: giftToRow(action.gift, planId),
      }
    // Updates send only the column that changed, so two people editing
    // different fields of one gift at the same time don't overwrite each other.
    case 'giftStatusChanged':
      return {
        table: 'gifts',
        op: 'update',
        id: action.giftId,
        values: { status: action.status },
      }
    case 'giftPurchaserSet':
      return {
        table: 'gifts',
        op: 'update',
        id: action.giftId,
        values: { purchaser_id: action.purchaserId },
      }
    case 'giftRemoved':
      return { table: 'gifts', op: 'delete', id: action.giftId }
  }
}

export class MutationError extends Error {
  readonly code: string | undefined

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'MutationError'
    this.code = code
  }
}

export async function runMutation(
  db: SupabaseClient<Database>,
  mutation: Mutation,
): Promise<void> {
  // toMutation already guarantees `values` fits `table`, but TypeScript can't
  // follow that link through a union of tables, so the query builder is
  // loosened here and nowhere else.
  const table = db.from(mutation.table) as unknown as LooseTable
  const result =
    mutation.op === 'insert'
      ? await table.insert(mutation.values)
      : mutation.op === 'update'
        ? await table.update(mutation.values).eq('id', mutation.id)
        : await table.delete().eq('id', mutation.id)
  if (result.error) {
    throw new MutationError(result.error.message, result.error.code)
  }
}

interface LooseResult {
  error: { message: string; code?: string } | null
}

interface LooseTable {
  insert(values: object): PromiseLike<LooseResult>
  update(values: object): {
    eq(column: 'id', value: string): PromiseLike<LooseResult>
  }
  delete(): { eq(column: 'id', value: string): PromiseLike<LooseResult> }
}
