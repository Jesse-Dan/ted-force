import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { LessThan, Like } from "typeorm";
import { StoredFile } from "../../../entities/stored-file.entity";

@FragmentRepository()
export class StoredFileRepository {
  @InjectRepository(StoredFile)
  private storedFileRepository!: Repository<StoredFile>;

  async findByAgentId(agentId: string): Promise<StoredFile[]> {
    return this.storedFileRepository.find({
      where: {
        agentId,
        isActive: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findById(fileId: string): Promise<StoredFile | null> {
    return this.storedFileRepository.findOne({
      where: {
        id: fileId,
        isActive: true,
      },
    });
  }

  async save(file: Partial<StoredFile>): Promise<StoredFile> {
    return this.storedFileRepository.save(file);
  }

  async findBySessionId(sessionId: string): Promise<StoredFile[]> {
    return this.storedFileRepository.find({
      where: { sessionId, isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  async search(term: string): Promise<StoredFile[]> {
    return this.storedFileRepository.find({
      where: [
        { originalFilename: Like(`%${term}%`), isActive: true },
        { storedFilename: Like(`%${term}%`), isActive: true },
      ],
      order: { createdAt: "DESC" },
      take: 100,
    });
  }

  async findExpired(now: Date): Promise<StoredFile[]> {
    return this.storedFileRepository.find({
      where: {
        expiresAt: LessThan(now),
        isActive: true,
      },
      order: {
        expiresAt: "ASC",
      },
    });
  }

  async deleteById(fileId: string) {
    await this.storedFileRepository.delete(fileId);
  }
}
