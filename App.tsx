import React, { useState, useEffect, useRef } from 'react';
import { Plus, LayoutList, BrainCircuit, CheckCircle2, Hash, Trash2, FolderPlus, MoreHorizontal } from 'lucide-react';
import { Todo, FilterType, Subtask, Group } from './types';
import { TodoItem } from './components/TodoItem';
import { Button } from './components/Button';
import { generateSubtasks, smartSortTodos } from './services/geminiService';

const STORAGE_KEY = 'lumina_todos_v2';
const GROUPS_KEY = 'lumina_groups_v1';

const DEFAULT_GROUP: Group = { id: 'inbox', name: 'Inbox', emoji: '📥', isDefault: true };

export default function App() {
  // State
  const [todos, setTodos] = useState<Todo[]>([]);
  const [groups, setGroups] = useState<Group[]>([DEFAULT_GROUP]);
  const [activeGroupId, setActiveGroupId] = useState<string>(DEFAULT_GROUP.id);
  const [newTodoText, setNewTodoText] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [filter, setFilter] = useState<FilterType>(FilterType.ALL);
  const [isAiSorting, setIsAiSorting] = useState(false);
  
  // Drag and Drop State
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    const savedTodos = localStorage.getItem(STORAGE_KEY);
    const savedGroups = localStorage.getItem(GROUPS_KEY);

    if (savedGroups) {
      try {
        setGroups(JSON.parse(savedGroups));
      } catch (e) {
        console.error("Failed to parse groups", e);
      }
    }

    if (savedTodos) {
      try {
        const parsed: Todo[] = JSON.parse(savedTodos);
        // Migration: Ensure all todos have a groupId
        const migrated = parsed.map(t => ({
          ...t,
          groupId: t.groupId || 'inbox'
        }));
        setTodos(migrated);
      } catch (e) {
        console.error("Failed to parse todos", e);
      }
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }, [groups]);

  // -- Group Handlers --

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      emoji: '📁' // Default emoji, could be randomized or picked
    };

    setGroups([...groups, newGroup]);
    setNewGroupName('');
    setIsAddingGroup(false);
    setActiveGroupId(newGroup.id);
  };

  const handleDeleteGroup = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const group = groups.find(g => g.id === groupId);
    if (group?.isDefault) return;

    if (window.confirm(`Delete "${group?.name}" and all its tasks?`)) {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setTodos(prev => prev.filter(t => t.groupId !== groupId));
      if (activeGroupId === groupId) {
        setActiveGroupId(DEFAULT_GROUP.id);
      }
    }
  };

  // -- Todo Handlers --

  const handleAddTodo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTodoText.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      groupId: activeGroupId,
      text: newTodoText.trim(),
      completed: false,
      createdAt: Date.now(),
      subtasks: [],
      isExpanded: false
    };

    setTodos(prev => [newTodo, ...prev]);
    setNewTodoText('');
  };

  const handleToggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        const isCompleted = !t.completed;
        return { 
          ...t, 
          completed: isCompleted,
          completedAt: isCompleted ? Date.now() : undefined
        };
      }
      return t;
    }));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const handleToggleSubtask = (todoId: string, subtaskId: string) => {
    setTodos(prev => prev.map(t => {
      if (t.id !== todoId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map(st => 
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        )
      };
    }));
  };

  const handleGenerateSubtasks = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    setTodos(prev => prev.map(t => t.id === id ? { ...t, isAiGenerating: true } : t));

    try {
      const suggestions = await generateSubtasks(todo.text);
      const newSubtasks: Subtask[] = suggestions.map(text => ({
        id: crypto.randomUUID(),
        text,
        completed: false
      }));

      setTodos(prev => prev.map(t => 
        t.id === id ? { 
          ...t, 
          subtasks: [...t.subtasks, ...newSubtasks],
          isExpanded: true,
          isAiGenerating: false
        } : t
      ));
    } catch (error) {
      console.error(error);
      setTodos(prev => prev.map(t => t.id === id ? { ...t, isAiGenerating: false } : t));
    }
  };

  const handleToggleExpand = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isExpanded: !t.isExpanded } : t));
  };

  const handleSmartSort = async () => {
    const currentGroupTodos = todos.filter(t => t.groupId === activeGroupId);
    const activeTodos = currentGroupTodos.filter(t => !t.completed);
    
    if (activeTodos.length < 2) return;

    setIsAiSorting(true);
    try {
      const sortedIds = await smartSortTodos(activeTodos);
      
      const sortedActiveTodos = sortedIds
        .map(id => activeTodos.find(t => t.id === id))
        .filter((t): t is Todo => !!t);

      const missedActiveTodos = activeTodos.filter(t => !sortedIds.includes(t.id));
      const completedGroupTodos = currentGroupTodos.filter(t => t.completed);
      const otherGroupTodos = todos.filter(t => t.groupId !== activeGroupId);

      // Reassemble: Others + (Sorted Active + Missed Active + Completed)
      setTodos([
        ...otherGroupTodos,
        ...sortedActiveTodos,
        ...missedActiveTodos,
        ...completedGroupTodos
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiSorting(false);
    }
  };

  // -- Drag and Drop Handlers --

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTodoId(id);
    // Needed for Firefox
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedTodoId || draggedTodoId === targetId) return;

    setTodos(prevTodos => {
      const newTodos = [...prevTodos];
      const draggedIndex = newTodos.findIndex(t => t.id === draggedTodoId);
      const targetIndex = newTodos.findIndex(t => t.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prevTodos;

      const [draggedItem] = newTodos.splice(draggedIndex, 1);
      newTodos.splice(targetIndex, 0, draggedItem);
      
      return newTodos;
    });

    setDraggedTodoId(null);
  };

  // -- Derived State --

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  
  const currentGroupTodos = todos.filter(t => t.groupId === activeGroupId);
  
  const filteredTodos = currentGroupTodos.filter(t => {
    if (filter === FilterType.ACTIVE) return !t.completed;
    if (filter === FilterType.COMPLETED) return t.completed;
    return true;
  });

  const activeCount = currentGroupTodos.filter(t => !t.completed).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-primary-100 selection:text-primary-900 flex flex-col">
      
      {/* Header / Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md bg-white/80 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary-600 text-white p-1.5 rounded-lg shadow-sm">
               <CheckCircle2 size={20} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:inline">Lumina Tasks</span>
            <span className="text-xl font-bold tracking-tight text-slate-900 sm:hidden">Lumina</span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                {todos.filter(t => !t.completed).length} total active tasks
             </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8 min-h-0">
        
        {/* Sidebar / Tabs */}
        <aside className="lg:w-64 flex-shrink-0 flex flex-col gap-6">
           
           {/* Groups List */}
           <div>
              <div className="flex items-center justify-between mb-3 px-2">
                 <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Groups</h2>
                 <button 
                    onClick={() => setIsAddingGroup(true)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                    title="Add Group"
                 >
                    <Plus size={16} />
                 </button>
              </div>

              <div className="space-y-1 lg:block flex overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
                 {groups.map(group => {
                    const isActive = group.id === activeGroupId;
                    const groupCount = todos.filter(t => t.groupId === group.id && !t.completed).length;
                    
                    return (
                       <button
                          key={group.id}
                          onClick={() => setActiveGroupId(group.id)}
                          className={`
                             group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full min-w-[140px] lg:min-w-0
                             ${isActive 
                                ? 'bg-white shadow-sm text-primary-700 ring-1 ring-slate-200' 
                                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                             }
                          `}
                       >
                          <span className="text-lg leading-none">{group.emoji}</span>
                          <span className="truncate flex-1 text-left">{group.name}</span>
                          {groupCount > 0 && (
                             <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600'}`}>
                                {groupCount}
                             </span>
                          )}
                          {!group.isDefault && isActive && (
                             <div 
                                onClick={(e) => handleDeleteGroup(group.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all ml-auto lg:ml-0"
                             >
                                <Trash2 size={14} />
                             </div>
                          )}
                       </button>
                    );
                 })}

                 {isAddingGroup && (
                    <form onSubmit={handleAddGroup} className="min-w-[140px] px-1">
                       <input 
                          autoFocus
                          type="text"
                          placeholder="Group name..."
                          className="w-full text-sm px-3 py-2 rounded-lg border border-primary-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                          value={newGroupName}
                          onChange={e => setNewGroupName(e.target.value)}
                          onBlur={() => !newGroupName && setIsAddingGroup(false)}
                       />
                    </form>
                 )}
              </div>
           </div>
           
           {/* Sidebar Info (Desktop only) */}
           <div className="hidden lg:block bg-slate-100 rounded-xl p-4 text-xs text-slate-500">
              <p className="mb-2 font-medium text-slate-700">Pro Tip</p>
              <p>Use "Smart Sort" to let AI organize your tasks based on urgency. You can also drag and drop tasks to reorder them manually.</p>
           </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          
          {/* Header for List */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span>{activeGroup.emoji}</span>
              {activeGroup.name}
            </h1>
            <p className="text-slate-500 mt-1">
              {activeCount === 0 ? 'All caught up!' : `${activeCount} tasks remaining`}
            </p>
          </div>

          {/* Input Area */}
          <div className="mb-6">
            <form onSubmit={handleAddTodo} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Plus className="h-6 w-6 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-24 py-4 bg-white border-0 text-slate-900 placeholder:text-slate-400 ring-1 ring-inset ring-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-inset focus:ring-primary-500 text-lg transition-shadow"
                placeholder={`Add a task to ${activeGroup.name}...`}
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                 <Button 
                   type="submit" 
                   disabled={!newTodoText.trim()}
                   className="rounded-xl"
                 >
                   Add
                 </Button>
              </div>
            </form>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            
            {/* Filters */}
            <div className="flex p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
              {(Object.values(FilterType) as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filter === f 
                      ? 'bg-primary-50 text-primary-700 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* AI Tools */}
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={handleSmartSort}
                isLoading={isAiSorting}
                disabled={currentGroupTodos.length < 2}
                className="w-full sm:w-auto text-xs sm:text-sm"
                title="Use AI to sort by priority"
              >
                {!isAiSorting && <BrainCircuit className="mr-2 h-4 w-4 text-violet-600" />}
                Smart Sort
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3 flex-1">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                 <div className="bg-white h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm">
                    <LayoutList size={32} />
                 </div>
                 <h3 className="text-base font-medium text-slate-900 mb-1">No tasks in {activeGroup.name}</h3>
                 <p className="text-sm text-slate-500 max-w-sm mx-auto">
                   {filter === FilterType.ALL 
                     ? "Add a task above to get started!" 
                     : `No ${filter.toLowerCase()} tasks found.`}
                 </p>
              </div>
            ) : (
              filteredTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={handleToggleTodo}
                  onDelete={handleDeleteTodo}
                  onToggleSubtask={handleToggleSubtask}
                  onGenerateSubtasks={handleGenerateSubtasks}
                  onToggleExpand={handleToggleExpand}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDraggable={filter === FilterType.ALL || filter === FilterType.ACTIVE}
                />
              ))
            )}
          </div>
          
          <footer className="mt-8 text-center text-xs text-slate-400 lg:text-left">
             <p>Powered by Google Gemini 2.5 Flash</p>
          </footer>

        </main>
      </div>
    </div>
  );
}