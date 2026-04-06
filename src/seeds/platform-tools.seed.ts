import { TypeORMModule } from "fragment-ts";
import { defaultPlatformTools } from "../constants/default-platform-tools";

export default class PlatformToolsSeed {
  static async run(): Promise<void> {
    console.log("Running platform-tools seed...");

    await TypeORMModule.initialize();
    const orm = TypeORMModule.getDataSource();

    for (const tool of Object.values(defaultPlatformTools)) {
      await orm.query(
        `
          INSERT INTO platform_tools (
            id,
            \`key\`,
            name,
            description,
            example,
            is_new,
            system_enabled,
            args,
            created_at,
            updated_at
          ) VALUES (
            UUID(),
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            NOW(),
            NOW()
          )
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            example = VALUES(example),
            is_new = VALUES(is_new),
            system_enabled = VALUES(system_enabled),
            args = VALUES(args),
            updated_at = NOW()
        `,
        [
          tool.key,
          tool.name,
          tool.description,
          tool.example,
          tool.isNew ? 1 : 0,
          tool.systemEnabled ? 1 : 0,
          JSON.stringify(tool.args ?? []),
        ],
      );
    }

    console.log("platform-tools seed completed.");
  }
}
