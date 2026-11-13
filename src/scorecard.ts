export interface DailyScorecard {
  date: string;
  launches: number;
  par?: number;
}

export function formatScorecard(scorecard: DailyScorecard): string {
  const launchLabel = `${scorecard.launches} ${scorecard.launches === 1 ? "launch" : "launches"}`;
  if (scorecard.par === undefined) {
    return `Squarenaut Daily · ${scorecard.date}\nCompleted in ${launchLabel}!`;
  }

  if (scorecard.launches < scorecard.par) {
    const difference = scorecard.par - scorecard.launches;
    return `Squarenaut Daily · ${scorecard.date}\n${launchLabel} · Par ${scorecard.par} · ${difference} under par`;
  }
  if (scorecard.launches > scorecard.par) {
    const difference = scorecard.launches - scorecard.par;
    return `Squarenaut Daily · ${scorecard.date}\n${launchLabel} · Par ${scorecard.par} · ${difference} over par`;
  }
  return `Squarenaut Daily · ${scorecard.date}\n${launchLabel} · Par ${scorecard.par} · on par`;
}

export function drawScorecard(context: CanvasRenderingContext2D, scorecard: DailyScorecard): void {
  const { width, height } = context.canvas;
  context.fillStyle = "#121820";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#1b242e";
  context.fillRect(24, 24, width - 48, height - 48);
  context.fillStyle = "#86a6bf";
  context.font = "700 24px system-ui, sans-serif";
  context.fillText("SQUARENAUT DAILY", 56, 90);
  context.fillStyle = "#e8edf5";
  context.font = "700 48px system-ui, sans-serif";
  context.fillText(scorecard.date, 56, 164);
  context.fillStyle = "#9de7ba";
  context.font = "700 34px system-ui, sans-serif";
  context.fillText(
    `${scorecard.launches} ${scorecard.launches === 1 ? "launch" : "launches"}`,
    56,
    250,
  );
  context.fillStyle = "#aab6c4";
  context.font = "24px system-ui, sans-serif";
  const result =
    scorecard.par === undefined
      ? "Completed!"
      : scorecard.launches < scorecard.par
        ? `Par ${scorecard.par} · ${scorecard.par - scorecard.launches} under par`
        : scorecard.launches > scorecard.par
          ? `Par ${scorecard.par} · ${scorecard.launches - scorecard.par} over par`
          : `Par ${scorecard.par} · on par`;
  context.fillText(result, 56, 310);
  context.fillStyle = "#86a6bf";
  context.font = "20px system-ui, sans-serif";
  context.fillText("squarenaut", 56, height - 56);
}

export async function shareScorecard(
  canvas: HTMLCanvasElement,
  scorecard: DailyScorecard,
): Promise<"shared" | "copied"> {
  const text = formatScorecard(scorecard);
  if (typeof navigator.share === "function") {
    if (
      typeof navigator.canShare === "function" &&
      typeof File !== "undefined" &&
      typeof canvas.toBlob === "function"
    ) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        const file = new File([blob], "squarenaut-scorecard.png", { type: "image/png" });
        const shareData = { title: "Squarenaut Daily", text, files: [file] };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return "shared";
        }
      }
    }
    await navigator.share({ title: "Squarenaut Daily", text });
    return "shared";
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error("Sharing and clipboard access are not available in this browser.");
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
