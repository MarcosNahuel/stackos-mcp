import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import { sessionCloseHandler } from './session-close';

vi.mock('fs');

describe('sessionCloseHandler', () => {
  it('marca tasks como resolved y genera draft', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ data: [{}], error: null });
    const mockSupabase = {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: mockUpdate,
            }),
          }),
        }),
      }),
    } as any;

    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

    const handler = sessionCloseHandler(mockSupabase, '/tmp/test-cn');
    const req = {
      body: {
        project_slug: 'traid',
        task_ids_resolved: ['uuid-123'],
        session_commits: ['fix: webhook auth'],
      },
    } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    await handler(req, res);

    expect(mockUpdate).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ resolved_count: 1, draft_id: expect.any(String) })
    );
  });

  it('responde resolved_count 0 si task_ids_resolved vacio', async () => {
    const mockSupabase = { schema: vi.fn() } as any;
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

    const handler = sessionCloseHandler(mockSupabase, '/tmp/test-cn');
    const req = {
      body: { project_slug: 'traid', task_ids_resolved: [], session_commits: [] },
    } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ resolved_count: 0 })
    );
  });
});
