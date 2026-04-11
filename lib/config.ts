// All tunable knobs for Ricochet's debate behavior. Edit here, not anywhere else.

export const INITIAL_VISIONARY_STANCE = 1.0;
export const INITIAL_CRITIC_STANCE = 0.5;

export const MIN_VISIONARY_STANCE = 0.2;
export const MAX_CRITIC_STANCE = 1.0;

export const VISIONARY_DECAY_STEP = 0.08;
export const CRITIC_DECAY_STEP = 0.05;

export const RESET_VISIONARY_STANCE = 0.75;
export const RESET_CRITIC_STANCE = 0.625;

export const MIN_EXCHANGES_BEFORE_JUDGE = 3;
export const JUDGE_EVERY_N_EXCHANGES = 1;
export const MAX_EXCHANGES_PER_CYCLE = 50;

export const IDEA_COUNT_MIN = 1;
export const IDEA_COUNT_MAX = 10;
export const IDEA_COUNT_DEFAULT = 3;

export const JUDGE_TEMPERATURE = 0.2;

export const VISIONARY_BUCKETS: Array<{
  min: number;
  max: number;
  descriptor: string;
  temperature: number;
}> = [
  {
    min: 0.85,
    max: 1.0,
    descriptor:
      "reckless dreamer — propose wildly ambitious, almost absurd ideas; ignore feasibility completely",
    temperature: 0.95,
  },
  {
    min: 0.65,
    max: 0.85,
    descriptor:
      "bold visionary — propose ambitious, unconventional ideas; lightly acknowledge constraints",
    temperature: 0.85,
  },
  {
    min: 0.45,
    max: 0.65,
    descriptor:
      "balanced innovator — propose creative but plausible ideas; weigh upside against feasibility",
    temperature: 0.75,
  },
  {
    min: 0.3,
    max: 0.45,
    descriptor:
      "grounded strategist — prefer practical ideas with a small stretch element",
    temperature: 0.65,
  },
  {
    min: 0.2,
    max: 0.3,
    descriptor:
      "pragmatic refiner — focus on concrete, shippable ideas and refinements of existing candidates",
    temperature: 0.55,
  },
];

export const CRITIC_BUCKETS: Array<{
  min: number;
  max: number;
  descriptor: string;
  temperature: number;
}> = [
  {
    min: 0.3,
    max: 0.45,
    descriptor:
      "supportive coach — highlight strengths first; raise concerns gently and constructively",
    temperature: 0.55,
  },
  {
    min: 0.45,
    max: 0.6,
    descriptor:
      "balanced reviewer — weigh strengths and weaknesses evenly; ask probing questions",
    temperature: 0.6,
  },
  {
    min: 0.6,
    max: 0.75,
    descriptor:
      "skeptical analyst — focus on feasibility gaps, hidden assumptions, and tradeoffs",
    temperature: 0.65,
  },
  {
    min: 0.75,
    max: 0.9,
    descriptor:
      "hard critic — stress-test aggressively; surface failure modes and risks",
    temperature: 0.7,
  },
  {
    min: 0.9,
    max: 1.0,
    descriptor:
      "ruthless adversary — attack every weakness; demand the idea justify its existence",
    temperature: 0.75,
  },
];
