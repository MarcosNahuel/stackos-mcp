import { describe, it, expect, vi } from 'vitest';
import { getTasksHandler } from './http-tasks';

describe('getTasksHandler', () => {
  it('retorna tasks vacio si no hay datos', async () => {
    const mockSupabase = {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as any;

    const handler = getTasksHandler(mockSupabase);
    const req = { query: { project: 'traid', status: 'open' } } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ tasks: [], count: 0 });
  });

  it('filtra por status especifico', async () => {
    const mockSupabase = {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as any;

    const handler = getTasksHandler(mockSupabase);
    const req = { query: { status: 'pending' } } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ tasks: [], count: 0 });
  });
});
