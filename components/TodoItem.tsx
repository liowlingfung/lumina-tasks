import React, { useState } from 'react';
import { Todo, Subtask } from '../types';
import { Check, Trash2, ChevronDown, ChevronUp, Sparkles, GripVertical } from 'lucide-react';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string) => void;
  onGenerateSubtasks: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  isDraggable: boolean;
}

export const TodoItem: React.FC<TodoItemProps> = ({ 
  todo, 
  onToggle, 
  onDelete, 
  onToggleSubtask,
  onGenerateSubtasks,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  isDraggable
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate progress
  const completedSubtasks = todo.subtasks.filter(st => st.completed).length;
  const totalSubtasks = todo.subtasks.length;
  const progress = totalSubtasks === 0 ? 0 : Math.round((completedSubtasks / totalSubtasks) * 100);

  // Date formatter
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  const handleDragStartInternal = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart(e, todo.id);
    // Set drag image or data if needed
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEndInternal = () => {
    setIsDragging(false);
  };

  return (
    <div 
      draggable={isDraggable}
      onDragStart={handleDragStartInternal}
      onDragEnd={handleDragEndInternal}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, todo.id)}
      className={`group relative flex items-start gap-2 rounded-xl border p-4 transition-all duration-200 ${
        isDragging ? 'opacity-40 bg-slate-100 border-dashed border-slate-400' : 
        todo.completed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-primary-200'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag Handle */}
      {isDraggable && (
        <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 flex-shrink-0">
          <GripVertical size={20} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start gap-3">
          {/* Main Checkbox */}
          <button
            onClick={() => onToggle(todo.id)}
            className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
              todo.completed 
                ? 'border-primary-500 bg-primary-500 text-white' 
                : 'border-slate-300 bg-white text-transparent hover:border-primary-400'
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <span 
                onClick={() => onToggleExpand(todo.id)}
                className={`cursor-pointer select-none text-base font-medium transition-colors ${
                  todo.completed ? 'text-slate-400 line-through' : 'text-slate-800'
                }`}
              >
                {todo.text}
              </span>
              
              {/* Action Buttons */}
              <div className={`flex items-center gap-1 transition-opacity duration-200 ${isHovered || todo.isExpanded ? 'opacity-100' : 'opacity-0 md:opacity-0'}`}>
                {!todo.completed && (
                  <button
                    onClick={() => onGenerateSubtasks(todo.id)}
                    disabled={todo.isAiGenerating}
                    className={`p-1.5 rounded-md text-primary-600 hover:bg-primary-50 transition-colors ${todo.isAiGenerating ? 'animate-pulse' : ''}`}
                    title="AI Break down task"
                  >
                    <Sparkles size={16} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(todo.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Metadata Row: Progress, Dates, Expand Toggle */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              
              {/* Progress Bar (if subtasks exist) */}
              {totalSubtasks > 0 && (
                <div className="flex items-center gap-2 text-slate-500 mr-2">
                    <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-primary-400 transition-all duration-300" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                    <span>{completedSubtasks}/{totalSubtasks}</span>
                </div>
              )}

              {/* Dates */}
              <span className="hidden sm:inline">Created {formatDate(todo.createdAt)}</span>
              
              {todo.completed && todo.completedAt && (
                  <span className="text-green-600/70 font-medium">
                    • Completed {formatDate(todo.completedAt)}
                  </span>
              )}

              {/* Expand Button */}
              {totalSubtasks > 0 && (
                <button 
                    onClick={() => onToggleExpand(todo.id)}
                    className="ml-auto flex items-center gap-0.5 hover:text-primary-600 text-slate-500"
                  >
                    {todo.isExpanded ? 'Hide steps' : 'Show steps'}
                    {todo.isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                </button>
              )}
            </div>
            
            {/* AI Loading State */}
            {todo.isAiGenerating && (
              <div className="mt-2 text-xs text-primary-600 flex items-center gap-1.5 animate-pulse">
                  <Sparkles size={10} />
                  <span>Generating steps...</span>
              </div>
            )}
          </div>
        </div>

        {/* Subtasks List */}
        {todo.isExpanded && todo.subtasks.length > 0 && (
          <div className="mt-3 ml-12 space-y-2 border-l-2 border-slate-100 pl-4">
            {todo.subtasks.map(subtask => (
              <div 
                key={subtask.id} 
                className="group/sub flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                <button
                  onClick={() => onToggleSubtask(todo.id, subtask.id)}
                  className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                    subtask.completed ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-300 hover:border-primary-400'
                  }`}
                >
                  {subtask.completed && <Check size={10} strokeWidth={3} />}
                </button>
                <span className={subtask.completed ? 'line-through text-slate-400' : ''}>
                  {subtask.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};