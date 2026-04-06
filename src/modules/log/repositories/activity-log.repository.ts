import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { ActivityLog } from "../../../entities/activity-log.entity";

@FragmentRepository()
export class ActivityLogRepository {
  @InjectRepository(ActivityLog)
  private activityLogRepository!: Repository<ActivityLog>;

  async findByAgentId(agentId: string): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { agentId },
      order: {
        createdAt: "DESC",
      },
      take: 100,
    });
  }

  async save(entry: Partial<ActivityLog>): Promise<ActivityLog> {
    return this.activityLogRepository.save(entry);
  }
}
