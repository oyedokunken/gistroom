"use client";

import { useEffect, useState } from "react";
import { passwordChecks, passwordIssue, type PasswordChecks } from "@gistroom/shared";

export type StrengthLevel = "empty" | "weak" | "okay" | "strong";

export interface Strength {
  level: StrengthLevel;
  checks: PasswordChecks;
  /** True while the estimator is still loading the first time. */
  loading: boolean;
  /** Weak passwords cannot be submitted. */
  acceptable: boolean;
}

type Estimator = (password: string, userInputs: string[]) => number;
let estimator: Promise<Estimator> | null = null;

/** The estimator and its dictionaries are about 400 KB, so they load on first use and never for visitors who do not type a password. */
function loadEstimator(): Promise<Estimator> {
  estimator ??= (async () => {
    const [{ ZxcvbnFactory }, common, en] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ]);
    const factory = new ZxcvbnFactory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary },
    });
    return (password, userInputs) => factory.check(password, userInputs).score;
  })();
  return estimator;
}

/** Turns a zxcvbn score (0 to 4) and the hard rules into the three levels the meter shows. */
export function levelFor(
  score: number | null,
  issueFree: boolean,
  checks: PasswordChecks,
): StrengthLevel {
  if (!issueFree || score === null || score < 2) return "weak";
  if (score >= 4 && checks.symbol) return "strong";
  if (score >= 3 && (checks.symbol || checks.length)) return score >= 4 ? "strong" : "okay";
  return "okay";
}

export function usePasswordStrength(password: string, userInputs: string[] = []): Strength {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const inputsKey = userInputs.join("|");

  useEffect(() => {
    if (!password) {
      setScore(null);
      return;
    }
    let live = true;
    setLoading(true);
    void loadEstimator().then((run) => {
      if (!live) return;
      setScore(run(password, inputsKey ? inputsKey.split("|") : []));
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [password, inputsKey]);

  const checks = passwordChecks(password);
  const issueFree = password.length > 0 && passwordIssue(password) === null;
  const level: StrengthLevel = password ? levelFor(score, issueFree, checks) : "empty";
  return {
    level,
    checks,
    loading: loading && score === null,
    acceptable: issueFree && level !== "weak",
  };
}
