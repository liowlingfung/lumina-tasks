export enum FilterType {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  isDefault?: boolean;
}

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Todo {
  id: string;
  groupId: string; // Links to a Group
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number; // Timestamp for completion
  subtasks: Subtask[];
  isExpanded: boolean; // For showing subtasks
  isAiGenerating?: boolean; // UI state for loading
}

export interface GeminiResponse {
  subtasks?: string[];
  sortedIds?: string[];
}