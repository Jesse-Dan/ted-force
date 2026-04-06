import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { JobExecution } from "../../../entities/job-execution.entity";

@FragmentRepository()
export class JobExecutionRepository {
  @InjectRepository(JobExecution)
  private jobExecutionRepository!: Repository<JobExecution>;

  async save(input: Partial<JobExecution>): Promise<JobExecution> {
    return this.jobExecutionRepository.save(input);
  }

  async findLatestByJobName(jobName: string): Promise<JobExecution | null> {
    return this.jobExecutionRepository.findOne({
      where: { jobName },
      order: { createdAt: "DESC" },
    });
  }

  async findLatestAll(limit = 20): Promise<JobExecution[]> {
    return this.jobExecutionRepository.find({
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
