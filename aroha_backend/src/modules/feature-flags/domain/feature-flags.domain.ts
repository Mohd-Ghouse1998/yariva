import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { FeatureFlag } from "../../../generated/prisma/client";

@Injectable()
export class FeatureFlagRuleService {
  evaluate(
    flag: FeatureFlag,
    input: { userId?: string | null },
  ): boolean {
    if (!flag.enabled || flag.deletedAt) {
      return false;
    }

    if (flag.scope === "GLOBAL") {
      return true;
    }

    if (!input.userId) {
      return false;
    }

    if (flag.scope === "USER_ALLOWLIST") {
      return parseAllowlist(flag.allowlistUserIds).includes(input.userId);
    }

    const rollout = Math.max(0, Math.min(100, flag.rolloutPercentage ?? 0));
    if (rollout === 0) {
      return false;
    }
    if (rollout === 100) {
      return true;
    }

    return stableBucket(`${flag.key}:${input.userId}`) < rollout;
  }
}

function parseAllowlist(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stableBucket(value: string): number {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) % 100;
}

