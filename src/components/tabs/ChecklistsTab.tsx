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
  onClearArrivalTasks
}) => {
  const [newDepText, setNewDepText] = useState("");
  const [newArrText, setNewArrText] = useState("");

  const depDoneCount = departureTasks.filter(t => t.done).length;
  const depPct = departureTasks.length > 0 ? Math.round((depDoneCount / departureTasks.length) * 100) : 0;

  const arrDoneCount = arrivalTasks.filter(t => t.done).length;
  const arrPct = arrivalTasks.length > 0 ? Math.round((arrDoneCount / arrivalTasks.length) * 100) : 0;

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

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
          <i className="fa-solid fa-list-check text-emerald-400"></i>
          <span>RV Safety &amp; Operation Checklists</span>
        </h2>
        <p className="text-xs text-slate-400">Pre-departure safety checks and campsite arrival &amp; hookup procedures.</p>
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
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {departureTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition text-xs"
              >
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 mr-2">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => onToggleDepartureTask(t.id)}
                    className="rounded bg-slate-900 border-slate-600 text-emerald-500"
                  />
                  <span className={t.done ? 'line-through text-slate-500' : 'text-slate-200'}>
                    {t.text}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => onDeleteDepartureTask(t.id)}
                  className="text-slate-500 hover:text-red-400 p-1 text-xs transition"
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
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-500"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition"
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
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {arrivalTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition text-xs"
              >
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 mr-2">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => onToggleArrivalTask(t.id)}
                    className="rounded bg-slate-900 border-slate-600 text-emerald-500"
                  />
                  <span className={t.done ? 'line-through text-slate-500' : 'text-slate-200'}>
                    {t.text}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => onDeleteArrivalTask(t.id)}
                  className="text-slate-500 hover:text-red-400 p-1 text-xs transition"
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
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-500"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition"
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
