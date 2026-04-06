import { Autowired, Service } from "fragment-ts";
import { WaitlistRepository } from "../repositories/waitlist.repository";

@Service()
export class WaitlistService {
  @Autowired()
  private waitlistRepository!: WaitlistRepository;

  async getAll() {
    return this.waitlistRepository.findAll();
  }

  async getByEmail(email: string) {
    return this.waitlistRepository.findByEmail(email);
  }
}
