import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

// mergeParams: true — this router is mounted inside tasks.ts at
// '/:taskId/comments', so it needs access to the parent's `:taskId` param.
const router = Router({ mergeParams: true });

router.use(requireAuth);

const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

const createCommentSchema = z.object({
  body: z.string().trim().min(1),
});

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: Date;
}

/** True if a task with `taskId` exists and belongs to `userId`. */
async function taskExistsForUser(taskId: string, userId: string): Promise<boolean> {
  const result = await query(`SELECT id FROM tasks WHERE id = $1 AND user_id = $2`, [taskId, userId]);
  return result.rows.length > 0;
}

// POST /tasks/:taskId/comments
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const parsedParams = taskIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedParams.error.flatten().fieldErrors });
      return;
    }

    const parsedBody = createCommentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedBody.error.flatten().fieldErrors });
      return;
    }

    const { taskId } = parsedParams.data;
    if (!(await taskExistsForUser(taskId, userId))) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { body } = parsedBody.data;
    const result = await query<CommentRow>(
      `INSERT INTO comments (task_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, user_id, body, created_at`,
      [taskId, userId, body],
    );
    res.status(201).json({ comment: result.rows[0] });
  }),
);

// GET /tasks/:taskId/comments
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const parsedParams = taskIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedParams.error.flatten().fieldErrors });
      return;
    }

    const { taskId } = parsedParams.data;
    if (!(await taskExistsForUser(taskId, userId))) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const result = await query<CommentRow>(
      `SELECT id, task_id, user_id, body, created_at
       FROM comments
       WHERE task_id = $1
       ORDER BY created_at DESC`,
      [taskId],
    );
    res.status(200).json({ comments: result.rows });
  }),
);

export default router;
