import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { DomainTemplate } from "../../../entities/domain-template.entity";

@FragmentRepository()
export class PublicDomainRepository {
  @InjectRepository(DomainTemplate)
  private domainTemplateRepository!: Repository<DomainTemplate>;

  async listAll() {
    return this.domainTemplateRepository.find({
      order: {
        title: "ASC",
      },
    });
  }
}
