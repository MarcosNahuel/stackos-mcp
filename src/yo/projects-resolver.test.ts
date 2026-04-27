import { describe, expect, it, vi } from "vitest";
import { resolveProjectSlug } from "./projects-resolver.js";

describe("resolveProjectSlug", () => {
  const mockClient = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  it("retorna slug desde mapeo cuando match exacto por repo_basename", async () => {
    mockClient.maybeSingle.mockResolvedValueOnce({
      data: { slug: "conocimiento-nahuel" },
      error: null,
    });
    const result = await resolveProjectSlug("conocimiento-nahuel", mockClient as never);
    expect(result).toBe("conocimiento-nahuel");
  });

  it("retorna basename normalizado cuando no hay match", async () => {
    mockClient.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await resolveProjectSlug("UNKNOWN-REPO", mockClient as never);
    expect(result).toBe("unknown-repo");
  });

  it("retorna null cuando hint vacío", async () => {
    const result = await resolveProjectSlug("", mockClient as never);
    expect(result).toBeNull();
  });
});
