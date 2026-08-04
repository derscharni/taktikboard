import Dexie, { type EntityTable } from 'dexie'
import type { Settings, TacticsBoard } from './types'

/**
 * Local-First-Datenbank (IndexedDB via Dexie).
 * Alle Daten bleiben auf dem Gerät.
 */
export class TaktikboardDatabase extends Dexie {
  boards!: EntityTable<TacticsBoard, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('taktikboard')
    this.version(1).stores({
      boards: 'id, updatedAt',
      settings: 'id',
    })
  }
}

export const db = new TaktikboardDatabase()

export function uid(): string {
  return crypto.randomUUID()
}
