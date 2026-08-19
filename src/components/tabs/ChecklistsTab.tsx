import React, { useState } from 'react';
import { ChecklistTask } from '../../types/checklist';

interface ChecklistsTabProps {
  departureTasks: ChecklistTask[];
  arrivalTasks: ChecklistTask[];
  onToggleDepartureTask: (id: string) => void;
  onToggleArrivalTask: (id: string) => void;
  onAddDepartureTask: (text: string) => void;
  onAddArrivalTask: (text: string) => void;
  onDeleteDepartureTask: (id: string) => void;
  onDeleteArrivalTask: (id: string) => void;
  onClearDepartureTasks: () => void;
  onClearArrivalTasks: () => void;
  onReorderDepartureTasks?: (tasks: ChecklistTask[]) => void;
  onReorderArrivalTasks?: (tasks: ChecklistTask[]) => void;
}

export const ChecklistsTab: React.FC<ChecklistsTabProps> = ({
  departureTasks,
  arrivalTasks,
  onToggleDepartureTask,
  onToggleArrivalTask,
  onAddDepartureTask,
  onAddArrivalTask,
  onDeleteDepartureTask,
  onDeleteArrivalTask,
  onClearDepartureTasks,
  onClearArrivalTasks,
  onReorderDepartureTasks,
  onReorderArrivalTasks
}) => {
  const [newDepText, setNewDepText] = useState("");
  const [newArrText, setNewArrText] = useState("");

  // Drag and Drop States
  const [draggedDepIdx, setDraggedDepIdx] = useState<number | null>(null);
  const [dragOverDepIdx, setDragOverDepIdx] = useState<number | null>(null);

  const [draggedArrIdx, setDraggedArrIdx] = useState<number | null>(null);
  const [dragOverArrIdx, setDragOverArrIdx] = useState<number | null>(null);

  const depDoneCount = departureTasks.filter(t => t.done).length;
  const depPct = departureTasks.length > 0 ? Math.round((depDoneCount / departureTasks.length) * 100) : 0;

  const arrDoneCount = arrivalTasks.filter(t => t.done).length;
  const arrPct = arrivalTasks.length > 0 ? Math.round((arrDoneCount / arrivalTasks.length) * 100) : 0;

  // Add Task Handlers
  const handleAddDep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepText.trim()) return;
    onAddDepartureTask(newDepText.trim());
    setNewDepText("");
  };

  const handleAddArr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArrText.trim()) return;
    onAddArrivalTask(newArrText.trim());
    setNewArrText("");
  };

  // Up / Down Button Move Handlers
  const moveDepartureTask = (index: number, direction: 'up' | 'down') => {
    if (!onReorderDepartureTasks) return;
    const list = [...departureTasks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    onReorderDepartureTasks(list);
  };

  const moveArrivalTask = (index: number, direction: 'up' | 'down') => {
    if (!onReorderArrivalTasks) return;
    const list = [...arrivalTasks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    onReorderArrivalTasks(list);
  };

  // Drag and Drop Handlers for Departure
  const handleDepDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedDepIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDepDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDepIdx !== idx) {
      setDragOverDepIdx(idx);
    }
  };

  const handleDepDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedDepIdx === null || draggedDepIdx === targetIdx || !onReorderDepartureTasks) {
      setDraggedDepIdx(null);
      setDragOverDepIdx(null);
      return;
    }
    const list = [...departureTasks];
    const [movedItem] = list.splice(draggedDepIdx, 1);
    list.splice(targetIdx, 0, movedItem);
    onReorderDepartureTasks(list);
    setDraggedDepIdx(null);
    setDragOverDepIdx(null);
  };

  const handleDepDragEnd = () => {
    setDraggedDepIdx(null);
    setDragOverDepIdx(null);
  };

  // Drag and Drop Handlers for Arrival
  const handleArrDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedArrIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleArrDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverArrIdx !== idx) {
      setDragOverArrIdx(idx);
    }
  };

  const handleArrDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedArrIdx === null || draggedArrIdx === targetIdx || !onReorderArrivalTasks) {
      setDraggedArrIdx(null);
      setDragOverArrIdx(null);
      return;
    }
    const list = [...arrivalTasks];
    const [movedItem] = list.splice(draggedArrIdx, 1);
    list.splice(targetIdx, 0, movedItem);
    onReorderArrivalTasks(list);
    setDraggedArrIdx(null);
    setDragOverArrIdx(null);
  };

  const handleArrDragEnd = () => {
    setDraggedArrIdx(null);
    setDragOverArrIdx(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
          <i className="fa-solid fa-list-check text-emerald-400"></i>
          <span>RV Safety &amp; Operation Checklists</span>
        </h2>
        <p className="text-xs text-slate-400">
          Pre-departure safety checks and campsite arrival &amp; hookup procedures. Drag or use arrows to customize the order of tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Departure Checklist */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-road text-amber-400"></i> Pre-Departure Checklist
              </h3>
              <p className="text-[11px] text-slate-400">Essential walk-around before driving.</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400">{depDoneCount}/{departureTasks.length} Done</span>
              <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${depPct}%` }} />
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {departureTasks.map((t, idx) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => handleDepDragStart(e, idx)}
                onDragOver={(e) => handleDepDragOver(e, idx)}
                onDrop={(e) => handleDepDrop(e, idx)}
                onDragEnd={handleDepDragEnd}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition text-xs select-none ${
                  draggedDepIdx === idx
                    ? 'opacity-40 bg-slate-800/40 border-dashed border-amber-500/60'
                    : dragOverDepIdx === idx
                    ? 'bg-slate-800 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                {/* Reordering Controls (Drag Handle + Up/Down Arrows) */}
                <div className="flex items-center gap-1.5 mr-2 text-slate-500 shrink-0">
                  <span
                    className="cursor-grab active:cursor-grabbing hover:text-amber-400 p-0.5 text-xs"
                    title="Drag to reorder"
                  >
                    <i className="fa-solid fa-grip-vertical"></i>
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveDepartureTask(idx, 'up')}
                      className="hover:text-amber-400 disabled:opacity-20 disabled:hover:text-slate-500 text-[9px] p-0.5 leading-none transition"
                      title="Move up"
                    >
                      <i className="fa-solid fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      disabled={idx === departureTasks.length - 1}
                      onClick={() => moveDepartureTask(idx, 'down')}
                      className="hover:text-amber-400 disabled:opacity-20 disabled:hover:text-slate-500 text-[9px] p-0.5 leading-none transition"
                      title="Move down"
                    >
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                  </div>
                </div>

                {/* Task Checkbox & Label */}
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 mr-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => onToggleDepartureTask(t.id)}
                    className="rounded bg-slate-900 border-slate-600 text-amber-500 focus:ring-0 shrink-0"
                  />
                  <span className={`truncate ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {t.text}
                  </span>
                </label>

                {/* Delete Task Button */}
                <button
                  type="button"
                  onClick={() => onDeleteDepartureTask(t.id)}
                  className="text-slate-500 hover:text-red-400 p-1 text-xs transition shrink-0"
                  title="Remove check"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>

          {/* Add Task Form */}
          <form onSubmit={handleAddDep} className="flex gap-2 pt-1 border-t border-slate-800">
            <input
              type="text"
              value={newDepText}
              onChange={(e) => setNewDepText(e.target.value)}
              placeholder="Add custom pre-trip check..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500"
            />
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition"
            >
              Add
            </button>
          </form>

          {departureTasks.length > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClearDepartureTasks}
                className="text-[11px] text-slate-500 hover:text-red-400 transition"
              >
                Reset All Departure Checks
              </button>
            </div>
          )}
        </div>

        {/* Camp Arrival & Setup Checklist */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-campground text-sky-400"></i> Camp Arrival &amp; Setup
              </h3>
              <p className="text-[11px] text-slate-400">Leveling, utilities &amp; hookup procedures.</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400">{arrDoneCount}/{arrivalTasks.length} Done</span>
              <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${arrPct}%` }} />
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {arrivalTasks.map((t, idx) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => handleArrDragStart(e, idx)}
                onDragOver={(e) => handleArrDragOver(e, idx)}
                onDrop={(e) => handleArrDrop(e, idx)}
                onDragEnd={handleArrDragEnd}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition text-xs select-none ${
                  draggedArrIdx === idx
                    ? 'opacity-40 bg-slate-800/40 border-dashed border-sky-500/60'
                    : dragOverArrIdx === idx
                    ? 'bg-slate-800 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                {/* Reordering Controls (Drag Handle + Up/Down Arrows) */}
                <div className="flex items-center gap-1.5 mr-2 text-slate-500 shrink-0">
                  <span
                    className="cursor-grab active:cursor-grabbing hover:text-sky-400 p-0.5 text-xs"
                    title="Drag to reorder"
                  >
                    <i className="fa-solid fa-grip-vertical"></i>
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveArrivalTask(idx, 'up')}
                      className="hover:text-sky-400 disabled:opacity-20 disabled:hover:text-slate-500 text-[9px] p-0.5 leading-none transition"
                      title="Move up"
                    >
                      <i className="fa-solid fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      disabled={idx === arrivalTasks.length - 1}
                      onClick={() => moveArrivalTask(idx, 'down')}
                      className="hover:text-sky-400 disabled:opacity-20 disabled:hover:text-slate-500 text-[9px] p-0.5 leading-none transition"
                      title="Move down"
                    >
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                  </div>
                </div>

                {/* Task Checkbox & Label */}
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 mr-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => onToggleArrivalTask(t.id)}
                    className="rounded bg-slate-900 border-slate-600 text-sky-500 focus:ring-0 shrink-0"
                  />
                  <span className={`truncate ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {t.text}
                  </span>
                </label>

                {/* Delete Task Button */}
                <button
                  type="button"
                  onClick={() => onDeleteArrivalTask(t.id)}
                  className="text-slate-500 hover:text-red-400 p-1 text-xs transition shrink-0"
                  title="Remove check"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>

          {/* Add Task Form */}
          <form onSubmit={handleAddArr} className="flex gap-2 pt-1 border-t border-slate-800">
            <input
              type="text"
              value={newArrText}
              onChange={(e) => setNewArrText(e.target.value)}
              placeholder="Add custom campsite setup check..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-sky-500"
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition"
            >
              Add
            </button>
          </form>

          {arrivalTasks.length > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClearArrivalTasks}
                className="text-[11px] text-slate-500 hover:text-red-400 transition"
              >
                Reset All Arrival Checks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
