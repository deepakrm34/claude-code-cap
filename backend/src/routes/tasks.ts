import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import commentsRouter from './comments';
import Anthropic from '@anthropic-ai/sdk';
import { enhanceTaskDescription, ClaudeConfigError, ClaudeResponseError } from '../services/claude';

const router = Router();

// Every route in this file requires a valid JWT; `req.user.sub` is the
// owning user's id and every query below filters on it.
router.use(requireAuth);

const statusEnum = z.enum(['todo', 'in_progress', 'done']);
const priorityEnum = z.enum(['low', 'medium', 'high']);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  // Column is NOT NULL — required, but an empty string is allowed.
  description: z.string(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    // null clears the column; undefined/omitted leaves it untouched.
    due_date: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.priority !== undefined ||
      data.due_date !== undefined,
    { message: 'At least one field must be provided' },
  );

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  ai_enhanced_description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

const TASK_COLUMNS = `
  id, user_id, title, description, ai_enhanced_description,
  status, priority, due_date, created_at, updated_at
`;

// GET /tasks
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const result = await query<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    res.status(200).json({ tasks: result.rows });
  }),
);

// POST /tasks
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const parsedBody = createTaskSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedBody.error.flatten().fieldErrors });
      return;
    }

    const { title, description, status, priority, due_date: dueDate } = parsedBody.data;

    const columns = ['user_id', 'title', 'description'];
    const values: unknown[] = [userId, title, description];
    if (status) {
      columns.push('status');
      values.push(status);
    }
    if (priority) {
      columns.push('priority');
      values.push(priority);
    }
    if (dueDate) {
      columns.push('due_date');
      values.push(dueDate);
    }

    const placeholders = values.map((_value, index) => `$${String(index + 1)}`).join(', ');
    const result = await query<TaskRow>(
      `INSERT INTO tasks (${columns.join(', ')}) VALUES (${placeholders}) RETURNING ${TASK_COLUMNS}`,
      values,
    );
    res.status(201).json({ task: result.rows[0] });
  }),
);

// GET /tasks/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const parsedParams = idParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedParams.error.flatten().fieldErrors });
      return;
    }

    const { id } = parsedParams.data;
    const result = await query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(200).json({ task: result.rows[0] });
  }),
);

/** Shared handler for PATCH and PUT /tasks/:id — updates only provided fields. */
async function updateTaskHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: 'Validation failed', details: parsedParams.error.flatten().fieldErrors });
    return;
  }

  const parsedBody = updateTaskSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Validation failed', details: parsedBody.error.flatten().fieldErrors });
    return;
  }

  const { id } = parsedParams.data;
  const { title, description, status, priority, due_date: dueDate } = parsedBody.data;

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) {
    values.push(title);
    setClauses.push(`title = $${String(values.length)}`);
  }
  if (description !== undefined) {
    values.push(description);
    setClauses.push(`description = $${String(values.length)}`);
  }
  if (status !== undefined) {
    values.push(status);
    setClauses.push(`status = $${String(values.length)}`);
  }
  if (priority !== undefined) {
    values.push(priority);
    setClauses.push(`priority = $${String(values.length)}`);
  }
  if (dueDate !== undefined) {
    values.push(dueDate);
    setClauses.push(`due_date = $${String(values.length)}`);
  }

  values.push(id);
  const idPlaceholder = `$${String(values.length)}`;
  values.push(userId);
  const userPlaceholder = `$${String(values.length)}`;

  const result = await query<TaskRow>(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ${idPlaceholder} AND user_id = ${userPlaceholder} RETURNING ${TASK_COLUMNS}`,
    values,
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.status(200).json({ task: result.rows[0] });
}

// PATCH /tasks/:id
router.patch('/:id', asyncHandler(updateTaskHandler));
// PUT /tasks/:id — same partial-update semantics as PATCH.
router.put('/:id', asyncHandler(updateTaskHandler));

// DELETE /tasks/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const parsedParams = idParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedParams.error.flatten().fieldErrors });
      return;
    }

    const { id } = parsedParams.data;
    const result = await query(`DELETE FROM tasks WHERE id = $1 AND user_id = $2`, [id, userId]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(204).send();
  }),
);

// POST /tasks/:id/enhance — rewrite the task via Claude and persist the result
// to ai_enhanced_description. Owner-scoped like every other route here.
router.post(
  '/:id/enhance',
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const parsedParams = idParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedParams.error.flatten().fieldErrors });
      return;
    }

    const { id } = parsedParams.data;
    const existing = await query<Pick<TaskRow, 'title' | 'description'>>(
      `SELECT title, description FROM tasks WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    let enhanced: string;
    try {
      const { title, description } = existing.rows[0];
      enhanced = await enhanceTaskDescription({ title, description });
    } catch (err) {
      if (err instanceof ClaudeConfigError) {
        res.status(503).json({ error: 'AI enhancement is not configured' });
        return;
      }
      if (err instanceof Anthropic.RateLimitError) {
        res.status(429).json({ error: 'AI service rate limit reached; try again shortly' });
        return;
      }
      if (err instanceof ClaudeResponseError) {
        res.status(502).json({ error: 'AI service returned no usable response' });
        return;
      }
      if (err instanceof Anthropic.APIError) {
        res.status(502).json({ error: 'AI service request failed' });
        return;
      }
      throw err;
    }

    // Re-scope the UPDATE by user_id; 404 if the task was deleted meanwhile.
    const result = await query<TaskRow>(
      `UPDATE tasks SET ai_enhanced_description = $1 WHERE id = $2 AND user_id = $3 RETURNING ${TASK_COLUMNS}`,
      [enhanced, id, userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(200).json({ task: result.rows[0] });
  }),
);

// Nested, owner-scoped comment routes: /tasks/:taskId/comments
router.use('/:taskId/comments', commentsRouter);

export default router;
