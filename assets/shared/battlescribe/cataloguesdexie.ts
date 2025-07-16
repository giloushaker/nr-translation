// db.ts
import Dexie, { Table } from "dexie";
import { BSIDataCatalogue, BSIDataSystem } from "./bs_types";

export class MySubClassedDexie extends Dexie {
  catalogues!: Table<{ id: string; content: BSIDataCatalogue; path?: string }>;
  systems!: Table<{ id: string; content: BSIDataSystem; path?: string }>;
  systemrows!: Table<any>;

  constructor() {
    super("nr-editor");
    this.version(6).stores({
      catalogues: "id, content.catalogue.id, content.catalogue.gameSystemId",
      systems: "id",
      systemrows: "id"
    });
  }
}

export const db = new MySubClassedDexie();
