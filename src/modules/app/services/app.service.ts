import { Service } from 'fragment-ts';

@Service()
export class AppService {
  getMessage(): string {
    return 'Digitwhale TUUL Service v2 is running.';
  }
}
