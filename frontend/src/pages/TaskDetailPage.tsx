import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAddCommentMutation,
  useDeleteTaskMutation,
  useEnhanceTaskMutation,
  useGetCommentsQuery,
  useGetTaskQuery,
  useUpdateTaskMutation,
  type TaskPriority,
  type TaskStatus,
} from '../store/api';
import { apiErrorMessage } from '../lib/apiError';
import { PRIORITY_BADGE, STATUS_BADGE, STATUS_LABELS } from '../lib/taskBadges';

function TaskDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: task, isLoading, error } = useGetTaskQuery(id, { skip: !id });
  const { data: comments } = useGetCommentsQuery(id, { skip: !id });
  const [updateTask, { error: updateError }] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [enhanceTask, { isLoading: enhancing, error: enhanceError }] = useEnhanceTaskMutation();
  const [addComment, { isLoading: commenting, error: commentError }] = useAddCommentMutation();

  const [commentBody, setCommentBody] = useState('');

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading task…</p>;
  }
  if (error !== undefined || !task) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error !== undefined ? apiErrorMessage(error) : 'Task not found'}
        </p>
        <Link to="/tasks" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          ← Back to tasks
        </Link>
      </div>
    );
  }

  const handleDelete = () => {
    void deleteTask(task.id)
      .unwrap()
      .then(() => navigate('/tasks'))
      .catch(() => {
        // Deletion errors are rare here; the list view will re-sync via tags.
      });
  };

  const handleAddComment = (event: FormEvent) => {
    event.preventDefault();
    void addComment({ taskId: task.id, body: commentBody })
      .unwrap()
      .then(() => setCommentBody(''))
      .catch(() => {
        // Surfaced via commentError.
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/tasks" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        ← Back to tasks
      </Link>

      {/* Task card */}
      <div className="space-y-4 rounded-xl bg-white p-6 shadow">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
          <button
            type="button"
            onClick={handleDelete}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
            {task.priority} priority
          </span>
          {task.due_date && (
            <span className="text-xs text-gray-500">due {new Date(task.due_date).toLocaleDateString()}</span>
          )}
        </div>

        {updateError !== undefined && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{apiErrorMessage(updateError)}</p>
        )}

        <div className="flex gap-3">
          <label className="text-sm text-gray-700">
            Status{' '}
            <select
              value={task.status}
              onChange={(e) => void updateTask({ id: task.id, status: e.target.value as TaskStatus })}
              className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Priority{' '}
            <select
              value={task.priority}
              onChange={(e) => void updateTask({ id: task.id, priority: e.target.value as TaskPriority })}
              className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">Description</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
            {task.description || <span className="italic text-gray-400">No description</span>}
          </p>
        </div>

        {/* AI enhancement */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-indigo-900">✨ AI-enhanced description</h2>
            <button
              type="button"
              onClick={() => void enhanceTask(task.id)}
              disabled={enhancing}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {enhancing ? 'Enhancing…' : 'Enhance with AI'}
            </button>
          </div>
          {enhanceError !== undefined && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{apiErrorMessage(enhanceError)}</p>
          )}
          {task.ai_enhanced_description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-indigo-900">{task.ai_enhanced_description}</p>
          ) : (
            !enhancing && (
              <p className="mt-3 text-xs text-indigo-700/70">
                No enhancement yet — Claude can rewrite this task to be clearer and more actionable.
              </p>
            )
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-4 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">
          Comments{comments ? ` (${String(comments.length)})` : ''}
        </h2>

        <ul className="space-y-3">
          {comments?.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.body}</p>
              <p className="mt-1 text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</p>
            </li>
          ))}
          {comments && comments.length === 0 && <li className="text-sm text-gray-500">No comments yet.</li>}
        </ul>

        <form onSubmit={handleAddComment} className="space-y-2">
          {commentError !== undefined && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{apiErrorMessage(commentError)}</p>
          )}
          <textarea
            required
            placeholder="Add a comment…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={commenting || !commentBody.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {commenting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TaskDetailPage;
