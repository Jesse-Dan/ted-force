import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { WaitlistEntry } from "../../../entities/waitlist-entry.entity";

@FragmentRepository()
export class WaitlistRepository {
  @InjectRepository(WaitlistEntry)
  private waitlistRepository!: Repository<WaitlistEntry>;

  async findAll(): Promise<WaitlistEntry[]> {
    return this.waitlistRepository.find({
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findByEmail(email: string): Promise<WaitlistEntry | null> {
    return this.waitlistRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }
}
