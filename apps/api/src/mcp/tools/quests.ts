import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  DIFFICULTY_ORDER,
  QUEST_PRIORITY,
  QUEST_STATUS,
  MAX_TAGS_PER_QUEST,
} from '@soloquest/shared';
import type { ApiProxy } from '../types';

type SlimTag = { id: string; name: string; color: string };

type QuestLike = {
  id: string;
  title: string;
  description?: string;
  difficulty: string;
  priority: string;
  status: string;
  deadline: string | Date | null;
  parentId: string | null;
  xpReward?: number;
  completedAt?: string | Date | null;
  createdAt?: string | Date;
  tags?: SlimTag[];
  subTasks?: QuestLike[];
  warnings?: string[];
};

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function toolJson(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function apiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return `Request failed with status ${status}`;
}

type SlimQuest = {
  id: string;
  title: string;
  difficulty: string;
  priority: string;
  status: string;
  deadline: string | Date | null;
  parentId: string | null;
  tags: SlimTag[];
  subTasks?: SlimQuest[];
};

function slimQuest(quest: QuestLike): SlimQuest {
  return {
    id: quest.id,
    title: quest.title,
    difficulty: quest.difficulty,
    priority: quest.priority,
    status: quest.status,
    deadline: quest.deadline,
    parentId: quest.parentId,
    tags: quest.tags ?? [],
    ...(quest.subTasks
      ? { subTasks: quest.subTasks.map(slimQuest) }
      : {}),
  };
}

const difficultySchema = z.enum(DIFFICULTY_ORDER);
const prioritySchema = z.enum(QUEST_PRIORITY);
const statusSchema = z.enum(QUEST_STATUS);

export function registerQuestTools(server: McpServer, apiProxy: ApiProxy): void {
  server.registerTool(
    'list-quests',
    {
      description:
        'List the authenticated user\'s quests. Defaults to all matching rows; use parentId "null" for top-level only, or include "subTasks" to nest children.',
      inputSchema: {
        status: statusSchema.optional().describe('Filter by quest status (active, completed, failed).'),
        parentId: z
          .union([z.string().uuid(), z.literal('null')])
          .optional()
          .describe('Filter by parent: uuid for that quest\'s sub-tasks, or "null" for top-level only.'),
        include: z
          .literal('subTasks')
          .optional()
          .describe('When "subTasks", each row includes nested sub-tasks.'),
      },
    },
    async ({ status, parentId, include }) => {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (parentId) query.set('parentId', parentId);
      if (include) query.set('include', include);
      const qs = query.toString();
      const path = qs.length > 0 ? `/api/quests?${qs}` : '/api/quests';
      const result = await apiProxy(path);
      if (!result.ok) return toolError(apiErrorMessage(result.body, result.status));
      if (!Array.isArray(result.body)) return toolError('Unexpected list response');
      return toolJson((result.body as QuestLike[]).map(slimQuest));
    },
  );

  server.registerTool(
    'get-quest',
    {
      description:
        'Fetch a single quest by id (owner-scoped), including tags and sub-tasks. Works for active and completed quests.',
      inputSchema: {
        id: z.string().uuid().describe('Quest id (UUID).'),
      },
    },
    async ({ id }) => {
      const result = await apiProxy(`/api/quests/${id}`);
      if (!result.ok) return toolError(apiErrorMessage(result.body, result.status));
      return toolJson(result.body);
    },
  );

  server.registerTool(
    'create-quest',
    {
      description:
        'Create a quest. Title and description are required. Difficulty ranks E–S (default E). Priority is a marker only (does not sort the list). XP is granted by the server, never sent by the client.',
      inputSchema: {
        title: z.string().min(1).max(255).describe('Quest title.'),
        description: z.string().min(1).describe('Quest description (required by the API).'),
        difficulty: difficultySchema.optional().describe('Rank / difficulty: E, D, C, B, A, or S.'),
        priority: prioritySchema.optional().describe('Importance marker: low, normal, or high.'),
        deadline: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe('ISO-8601 deadline; omit for none.'),
        parentId: z
          .string()
          .uuid()
          .optional()
          .describe('Parent quest id to create as a sub-task (one level deep).'),
        tagIds: z
          .array(z.string().uuid())
          .max(MAX_TAGS_PER_QUEST)
          .optional()
          .describe('Existing tag ids to pin (max 10).'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        title: args.title,
        description: args.description,
      };
      if (args.difficulty !== undefined) body.difficulty = args.difficulty;
      if (args.priority !== undefined) body.priority = args.priority;
      if (args.deadline !== undefined) body.deadline = args.deadline;
      if (args.parentId !== undefined) body.parentId = args.parentId;
      if (args.tagIds !== undefined) body.tagIds = args.tagIds;

      const result = await apiProxy('/api/quests', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!result.ok) return toolError(apiErrorMessage(result.body, result.status));
      return toolJson(result.body);
    },
  );

  server.registerTool(
    'update-quest',
    {
      description:
        'Update an active quest (partial). Only active quests can be edited. Omit a field to leave it unchanged; pass deadline null to clear it; pass tagIds [] to clear tags. Empty updates are rejected.',
      inputSchema: {
        id: z.string().uuid().describe('Quest id (UUID).'),
        title: z.string().min(1).max(255).optional().describe('New title.'),
        description: z.string().min(1).optional().describe('New description.'),
        difficulty: difficultySchema.optional().describe('New rank / difficulty.'),
        priority: prioritySchema.optional().describe('New priority marker.'),
        deadline: z
          .union([z.string().datetime({ offset: true }), z.null()])
          .optional()
          .describe('ISO-8601 deadline, or null to clear.'),
        parentId: z
          .union([z.string().uuid(), z.null()])
          .optional()
          .describe('New parent id, or null to promote to top-level.'),
        tagIds: z
          .array(z.string().uuid())
          .max(MAX_TAGS_PER_QUEST)
          .optional()
          .describe('Full replacement set of tag ids; [] clears all.'),
      },
    },
    async ({ id, ...fields }) => {
      const body: Record<string, unknown> = {};
      if (fields.title !== undefined) body.title = fields.title;
      if (fields.description !== undefined) body.description = fields.description;
      if (fields.difficulty !== undefined) body.difficulty = fields.difficulty;
      if (fields.priority !== undefined) body.priority = fields.priority;
      if (fields.deadline !== undefined) body.deadline = fields.deadline;
      if (fields.parentId !== undefined) body.parentId = fields.parentId;
      if (fields.tagIds !== undefined) body.tagIds = fields.tagIds;

      if (Object.keys(body).length === 0) {
        return toolError('No fields to update');
      }

      const result = await apiProxy(`/api/quests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!result.ok) return toolError(apiErrorMessage(result.body, result.status));
      return toolJson(result.body);
    },
  );
}
