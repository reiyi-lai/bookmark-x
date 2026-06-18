import OpenAI from 'openai';
import { Category } from '@shared/schema';

const BATCH_SIZE = 10;

function buildCategoryList(categories: Category[]): string {
  return categories
    .map((c) => `- "${c.name}"${c.description ? `: ${c.description}` : ""}`)
    .join("\n");
}

class OpenAICategorizer {
  private client: OpenAI;
  private categories: Category[];
  private categoryList: string;

  constructor(categories: Category[]) {
    this.client = new OpenAI();
    this.categories = categories;
    this.categoryList = buildCategoryList(categories);
  }

  private getDefaultCategoryId(): number {
    const uncategorized = this.categories.find(c =>
      c.name.toLowerCase() === 'uncategorized'
    );
    return uncategorized ? uncategorized.id : this.categories[0].id;
  }

  private systemPrompt(): string {
    return `You are a bookmark categorization assistant. Categorize each text into one of the following categories:
${this.categoryList}

Rules:
- "Job Opportunities": ONLY if explicit hiring language like "hiring", "looking for [role]"
- "Academic Research": Research papers, arxiv, technical AI/ML content
- "Personal Reads": Quotes, reflections, philosophical content
- "Content Ideas": Content strategy, creation tips, viral marketing
- "Automation Tools": Tool launches, dev tools, "built this" announcements
- Use the exact category names from the list above
- When in doubt, use "Uncategorized"`;
  }

  private findCategoryByName(name: string): Category | undefined {
    return this.categories.find(c => c.name.toLowerCase() === name.toLowerCase()) ||
      this.categories.find(c =>
        c.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(c.name.toLowerCase())
      );
  }

  async categorize(text: string): Promise<number> {
    try {
      const response = await this.client.responses.create({
        model: 'gpt-4o-mini',
        instructions: this.systemPrompt(),
        input: `Categorize this bookmark. Respond with ONLY the category name, nothing else.\n\n"${text}"`,
      });

      const cat = this.findCategoryByName(response.output_text.trim());
      return cat?.id ?? this.getDefaultCategoryId();
    } catch (err) {
      console.error('OpenAI categorize error:', err);
      return this.getDefaultCategoryId();
    }
  }

  async categorizeBatch(texts: string[]): Promise<number[]> {
    if (texts.length === 0) return [];

    console.log(`OpenAI batch categorization: ${texts.length} texts in chunks of ${BATCH_SIZE}`);
    const results: number[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      console.log(`Processing chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);

      try {
        const numberedTexts = chunk
          .map((text, idx) => `${idx + 1}. "${text}"`)
          .join('\n');

        const response = await this.client.responses.create({
          model: 'gpt-4o-mini',
          instructions: this.systemPrompt() + `\n\nRespond with ONLY a JSON object like:
{"results": [{"index": 1, "category": "Category Name"}, ...]}
Do not include any text before or after the JSON.`,
          input: numberedTexts,
        });

        const chunkIds = this.parseBatchResponse(response.output_text.trim(), chunk.length);
        results.push(...chunkIds);

        if (i + BATCH_SIZE < texts.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (err) {
        console.error(`OpenAI chunk ${Math.floor(i / BATCH_SIZE) + 1} error:`, err);
        results.push(...new Array(chunk.length).fill(this.getDefaultCategoryId()));
      }
    }

    console.log(`OpenAI batch done: ${results.length}/${texts.length} categorized`);
    return results;
  }

  private parseBatchResponse(raw: string, expectedCount: number): number[] {
    const defaultId = this.getDefaultCategoryId();
    try {
      let cleaned = raw;
      if (cleaned.includes('```json')) {
        cleaned = cleaned.substring(cleaned.indexOf('```json') + 7);
        cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
      } else if (cleaned.includes('```')) {
        cleaned = cleaned.substring(cleaned.indexOf('```') + 3);
        cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
      }
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd);
      }

      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed.results)) throw new Error('Missing results array');

      const ids: number[] = new Array(expectedCount).fill(defaultId);
      for (const r of parsed.results) {
        const idx = r.index - 1;
        if (idx < 0 || idx >= expectedCount || typeof r.category !== 'string') continue;
        const cat = this.findCategoryByName(r.category.trim());
        if (cat) ids[idx] = cat.id;
      }
      return ids;
    } catch (err) {
      console.error('Failed to parse OpenAI batch response:', err);
      return new Array(expectedCount).fill(defaultId);
    }
  }
}

export class MLCategorizer {
  private openai: OpenAICategorizer;

  constructor(categories: Category[]) {
    this.openai = new OpenAICategorizer(categories);
  }

  async categorize(text: string): Promise<number> {
    return this.openai.categorize(text);
  }

  async categorizeBatch(texts: string[]): Promise<number[]> {
    return this.openai.categorizeBatch(texts);
  }
}

export function createCategorizer(categories: Category[]): MLCategorizer {
  return new MLCategorizer(categories);
}
