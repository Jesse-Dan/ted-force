import { Autowired, Service } from "fragment-ts";
import { defaultPlatformTools } from "../../../constants/default-platform-tools";
import { PlatformToolRepository } from "../repositories/platform-tool.repository";

@Service()
export class PlatformToolSyncService {
  @Autowired()
  private platformToolRepository!: PlatformToolRepository;

  async syncRegistry() {
    const existing = await this.platformToolRepository.listAll();
    const existingByKey = new Map(existing.map((tool) => [tool.key, tool]));
    let created = 0;
    let updated = 0;

    for (const definition of Object.values(defaultPlatformTools)) {
      const current = existingByKey.get(definition.key);

      await this.platformToolRepository.save({
        ...(current ?? {}),
        key: definition.key,
        name: definition.name,
        description: definition.description,
        example: definition.example,
        isNew: definition.isNew,
        systemEnabled: definition.systemEnabled,
        args: definition.args,
      });

      if (current) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return {
      created,
      updated,
      total: Object.keys(defaultPlatformTools).length,
    };
  }
}
