import type { IOrm, ISchemas } from '@shared/types/db';
import { sql } from 'drizzle-orm';

const migrate = async (orm: IOrm, _schemas: ISchemas): Promise<void> => {
  /**
   * tbl_channel refactor
   * add column: headers
   */
  await orm.run(sql`
      CREATE TABLE IF NOT EXISTS __new_tbl_channel (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        api       TEXT NOT NULL,
        logo      TEXT,
        playback  TEXT,
        headers   TEXT DEFAULT '{}',           -- JSON
        "group"   TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
  await orm.run(
    sql`INSERT INTO __new_tbl_channel (id, name, api, logo, playback, headers, "group", createdAt, updatedAt)
      SELECT id, name, api, logo, playback, '{}', "group", createdAt, updatedAt FROM tbl_channel;`,
  );
  await orm.run(sql`DROP TABLE tbl_channel;`);
  await orm.run(sql`ALTER TABLE __new_tbl_channel RENAME TO tbl_channel;`);
};

export default migrate;
