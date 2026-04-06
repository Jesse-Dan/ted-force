import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { WaitlistEntry } from "../../../entities/waitlist-entry.entity";

@FragmentRepository()
export class PublicWaitlistRepository {
  @InjectRepository(WaitlistEntry)
  private waitlistRepository!: Repository<WaitlistEntry>;

  async findByEmail(email: string): Promise<WaitlistEntry | null> {
    return this.waitlistRepository.findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  async save(entry: Partial<WaitlistEntry>): Promise<WaitlistEntry> {
    return this.waitlistRepository.save(entry);
  }
}
