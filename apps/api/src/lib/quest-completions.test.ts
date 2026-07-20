import { describe, it, expect } from 'vitest';
import { buildQuestCompletion } from './quest-completions';
import type { Quest } from './quests';

const quest: Quest = {
  id: 'quest-1',
  userId: 'user-1',
  parentId: null,
  title: 'Slay the demon',
  description: 'A long overdue errand',
  difficulty: 'A',
  status: 'active',
  priority: 'normal',
  xpReward: 250,
  deadline: null,
  completedAt: null,
  createdAt: new Date('2026-07-01T10:00:00Z'),
};

describe('buildQuestCompletion', () => {
  const completedAt = new Date('2026-07-13T12:00:00Z');

  it('snapshots the quest fields the event must survive on', () => {
    expect(buildQuestCompletion(quest, 250, completedAt)).toEqual({
      userId: 'user-1',
      questId: 'quest-1',
      title: 'Slay the demon',
      difficulty: 'A',
      xpAwarded: 250,
      completedAt,
    });
  });

  it('records the XP actually granted, not the quest\'s current reward', () => {
    // The reward table can change later; the event keeps what the player was paid.
    expect(buildQuestCompletion(quest, 10, completedAt).xpAwarded).toBe(10);
  });

  it('carries no status or deadline — the event is a fact, not a copy of the quest', () => {
    expect(buildQuestCompletion(quest, 250, completedAt)).not.toHaveProperty('status');
  });
});
