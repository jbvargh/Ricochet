import {
  CRITIC_BUCKETS,
  INITIAL_CRITIC_STANCE,
  INITIAL_VISIONARY_STANCE,
  MAX_CRITIC_STANCE,
  MIN_VISIONARY_STANCE,
  RESET_CRITIC_STANCE,
  RESET_VISIONARY_STANCE,
  VISIONARY_BUCKETS,
  VISIONARY_DECAY_STEP,
  CRITIC_DECAY_STEP,
} from "@/lib/config";
import type { Stance } from "@/lib/session/types";

export function applyDecayStep(stance: Stance): Stance {
  return {
    visionary: Math.max(
      MIN_VISIONARY_STANCE,
      stance.visionary - VISIONARY_DECAY_STEP,
    ),
    critic: Math.min(MAX_CRITIC_STANCE, stance.critic + CRITIC_DECAY_STEP),
  };
}

export function resetStance(): Stance {
  return {
    visionary: RESET_VISIONARY_STANCE,
    critic: RESET_CRITIC_STANCE,
  };
}

export function initialStance(): Stance {
  return {
    visionary: INITIAL_VISIONARY_STANCE,
    critic: INITIAL_CRITIC_STANCE,
  };
}

/** Matches §1.4 Visionary bucket table (half-open intervals where shown). */
export function visionaryDescriptor(v: number): {
  text: string;
  temperature: number;
} {
  if (v >= 0.85 && v <= 1.0) return pickV(0);
  if (v >= 0.65 && v < 0.85) return pickV(1);
  if (v >= 0.45 && v < 0.65) return pickV(2);
  if (v >= 0.3 && v < 0.45) return pickV(3);
  if (v >= 0.2 && v < 0.3) return pickV(4);
  const last = VISIONARY_BUCKETS[VISIONARY_BUCKETS.length - 1]!;
  return { text: last.descriptor, temperature: last.temperature };
}

function pickV(index: number) {
  const b = VISIONARY_BUCKETS[index]!;
  return { text: b.descriptor, temperature: b.temperature };
}

/** Matches §1.4 Critic bucket table (half-open intervals where shown). */
export function criticDescriptor(c: number): {
  text: string;
  temperature: number;
} {
  if (c >= 0.3 && c < 0.45) return pickC(0);
  if (c >= 0.45 && c < 0.6) return pickC(1);
  if (c >= 0.6 && c < 0.75) return pickC(2);
  if (c >= 0.75 && c < 0.9) return pickC(3);
  if (c >= 0.9 && c <= 1.0) return pickC(4);
  const last = CRITIC_BUCKETS[CRITIC_BUCKETS.length - 1]!;
  return { text: last.descriptor, temperature: last.temperature };
}

function pickC(index: number) {
  const b = CRITIC_BUCKETS[index]!;
  return { text: b.descriptor, temperature: b.temperature };
}
