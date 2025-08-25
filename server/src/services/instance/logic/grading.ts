export type BeatGrade = "Perfect" | "Great" | "Good" | "Bad" | "Miss";

export function gradeBeat(
  nowMs: number,
  clientBeatTimeMs: number
): {
  grade: BeatGrade;
  rateDelta: number;
  manaDelta: number;
} {
  const delta = Math.abs(nowMs - clientBeatTimeMs);
  let grade: BeatGrade = "Miss";
  if (delta <= 33) grade = "Perfect";
  else if (delta <= 66) grade = "Great";
  else if (delta <= 116) grade = "Good";
  else if (delta <= 166) grade = "Bad";

  let rateDelta = 0;
  if (grade === "Perfect") rateDelta = 1;
  else if (grade === "Bad" || grade === "Miss") rateDelta = -1;
  const manaDelta = Math.sign(rateDelta) * 1;
  return { grade, rateDelta, manaDelta };
}
