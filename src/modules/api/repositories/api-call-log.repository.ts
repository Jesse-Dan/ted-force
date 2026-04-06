import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { ApiCallLog } from "../../../entities/api-call-log.entity";

@FragmentRepository()
export class ApiCallLogRepository {
  @InjectRepository(ApiCallLog)
  private apiCallLogRepository!: Repository<ApiCallLog>;

  async findByAgentId(agentId: string): Promise<ApiCallLog[]> {
    return this.apiCallLogRepository.find({
      where: { agentId },
      order: {
        createdAt: "DESC",
      },
      take: 100,
    });
  }
}
