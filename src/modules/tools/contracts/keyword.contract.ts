export interface KeywordVariant {
  name: string;
  description: string;
  tags: string[];
  exampleCode?: string;
}

export interface KeywordContract {
  name: string;
  description: string;
  tags: string[];
  variants: KeywordVariant[];
}
