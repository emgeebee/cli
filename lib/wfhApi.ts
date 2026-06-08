import { z } from "zod";

export const WFH_API_URL = "http://emgeebee.buzz:1880/api/wfh";

const WfhResponseSchema = z.object({
  wfh: z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean()),
});

export async function fetchWfhStatus(): Promise<boolean | null> {
  try {
    const response = await fetch(WFH_API_URL, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return null;
    }
    return WfhResponseSchema.parse(await response.json()).wfh;
  } catch {
    return null;
  }
}

const UK_TZ = "Europe/London";

export function formatWfhLine(wfh: boolean | null): string {
  if (wfh == null) return "wfh: -";
  return `wfh: ${wfh ? "yes" : "no"}`;
}

export function houseSectionLabel(now: Date, wfh: boolean | null): string {
  const weekday = now.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: UK_TZ,
  }).toLowerCase();
  if (weekday === "saturday" || weekday === "sunday") {
    return "house (weekend)";
  }
  if (wfh === true) {
    return "house (WFH)";
  }
  return "house (office)";
}

export async function toggleWfhStatus(): Promise<boolean> {
  const response = await fetch(WFH_API_URL, { method: "PUT" });
  if (!response.ok) {
    throw new Error(`WFH toggle failed (${response.status})`);
  }
  const status = await fetchWfhStatus();
  if (status == null) {
    throw new Error("WFH toggle succeeded but status could not be read");
  }
  return status;
}
