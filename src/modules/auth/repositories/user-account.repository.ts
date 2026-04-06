import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { UserAccount } from "../../../entities/user-account.entity";

@FragmentRepository()
export class UserAccountRepository {
  @InjectRepository(UserAccount)
  private userAccountRepository!: Repository<UserAccount>;

  async findById(userId: string): Promise<UserAccount | null> {
    return this.userAccountRepository.findOne({
      where: { id: userId },
      relations: {
        memberships: true,
      },
    });
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    return this.userAccountRepository.findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  async save(user: Partial<UserAccount>): Promise<UserAccount> {
    return this.userAccountRepository.save(user);
  }
}
