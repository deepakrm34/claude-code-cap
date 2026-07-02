import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetTasksQuery,
  type TaskPriority,
  type TaskStatus,
} from '../store/api';
import { apiErrorMessage } from '../lib/apiError';
import { PRIORITY_BADGE, STATUS_BADGE, STATUS_LABELS } from '../lib/taskBadges';

function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');

  const filters = useMemo(() => {
    if (!statusFilter && !priorityFilter) return undefined;
    return {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(priorityFilter ? { priority: priorityFilter } : {}),
    };
  }, [statusFilter, priorityFilter]);

  const { data: tasks, isLoading, error } = useGetTasksQuery(filters);
  const [createTask, { isLoading: creating, error: createError }] = useCreateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    void createTask({ title, description, priority })
      .unwrap()
      .then(() => {
        setTitle('');
        setDescription('');
        setPriority('medium');
      })
      .catch(() => {
        // Error is surfaced via createError below.
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-3 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">New task</h2>
        {createError !== undefined && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{apiErrorMessage(createError)}</p>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            required
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? 'Adding…' : 'Add task'}
        </button>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Task list */}
      {isLoading && <p className="text-sm text-gray-500">Loading tasks…</p>}
      {error !== undefined && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{apiErrorMessage(error)}</p>
      )}
      {tasks && tasks.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No tasks yet — add your first one above.
        </p>
      )}
      <ul className="space-y-3">
        {tasks?.map((task) => (
          <li key={task.id} className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  to={`/tasks/${task.id}`}
                  className="block truncate text-base font-semibold text-gray-900 hover:text-indigo-600"
                >
                  {task.title}
                </Link>
                {task.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{task.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${PRIORITY_BADGE[task.priority]}`}>
                    {task.priority}
                  </span>
                  {task.due_date && (
                    <span className="text-gray-500">due {new Date(task.due_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void deleteTask(task.id)}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TasksPage;
