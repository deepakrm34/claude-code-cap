import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// --- Backend contract types (mirror backend/src/routes responses) -----------

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  ai_enhanced_description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
}

export interface UpdateTaskRequest {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      // Typed structurally to avoid a circular import with the store/auth slice.
      const { token } = (getState() as { auth: { token: string | null } }).auth;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Task', 'Comment'],
  endpoints: (build) => ({
    // --- Auth ---------------------------------------------------------------
    register: build.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    me: build.query<User, void>({
      query: () => '/auth/me',
      transformResponse: (response: { user: User }) => response.user,
    }),

    // --- Tasks --------------------------------------------------------------
    getTasks: build.query<Task[], TaskFilters | void>({
      query: (filters) => ({ url: '/tasks', params: filters ?? undefined }),
      transformResponse: (response: { tasks: Task[] }) => response.tasks,
      providesTags: (result) =>
        result
          ? [...result.map((t) => ({ type: 'Task' as const, id: t.id })), { type: 'Task' as const, id: 'LIST' }]
          : [{ type: 'Task' as const, id: 'LIST' }],
    }),
    getTask: build.query<Task, string>({
      query: (id) => `/tasks/${id}`,
      transformResponse: (response: { task: Task }) => response.task,
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),
    createTask: build.mutation<Task, CreateTaskRequest>({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      transformResponse: (response: { task: Task }) => response.task,
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    updateTask: build.mutation<Task, UpdateTaskRequest>({
      query: ({ id, ...patch }) => ({ url: `/tasks/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (response: { task: Task }) => response.task,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),
    enhanceTask: build.mutation<Task, string>({
      query: (id) => ({ url: `/tasks/${id}/enhance`, method: 'POST' }),
      transformResponse: (response: { task: Task }) => response.task,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),
    deleteTask: build.mutation<void, string>({
      query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
        { type: 'Comment', id },
      ],
    }),

    // --- Comments (nested under a task) --------------------------------------
    getComments: build.query<TaskComment[], string>({
      query: (taskId) => `/tasks/${taskId}/comments`,
      transformResponse: (response: { comments: TaskComment[] }) => response.comments,
      providesTags: (_result, _error, taskId) => [{ type: 'Comment', id: taskId }],
    }),
    addComment: build.mutation<TaskComment, { taskId: string; body: string }>({
      query: ({ taskId, body }) => ({ url: `/tasks/${taskId}/comments`, method: 'POST', body: { body } }),
      transformResponse: (response: { comment: TaskComment }) => response.comment,
      invalidatesTags: (_result, _error, { taskId }) => [{ type: 'Comment', id: taskId }],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useMeQuery,
  useGetTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useEnhanceTaskMutation,
  useDeleteTaskMutation,
  useGetCommentsQuery,
  useAddCommentMutation,
} = api;
