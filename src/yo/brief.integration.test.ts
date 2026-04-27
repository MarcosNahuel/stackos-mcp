import { describe, expect, it } from "vitest";
import { getYoSupabase } from "../utils/yo-supabase.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;
import { buildFullBrief } from "./brief.js";

const RUN = process.env.YO_INTEGRATION === "true";

describe.skipIf(!RUN)("buildFullBrief integration", () => {
  it("retorna markdown válido para proyecto conocimiento-nahuel", async () => {
    const client = getYoSupabase() as AnyClient;
    const { markdown, data } = await buildFullBrief(client, "conocimiento-nahuel", 5);
    expect(markdown).toContain("conocimiento-nahuel");
    expect(data.project).toBe("conocimiento-nahuel");
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  it("retorna minimal cuando proyecto sin tasks", async () => {
    const client = getYoSupabase() as AnyClient;
    const { markdown } = await buildFullBrief(client, "proyecto-inexistente-xyz", 5);
    expect(markdown).toContain("proyecto-inexistente-xyz");
    expect(markdown).toContain("Sin tasks pending");
  });
});
