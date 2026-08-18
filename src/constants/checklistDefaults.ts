import { ChecklistTask } from '../types/checklist';

export const INITIAL_DEPARTURE_TASKS: ChecklistTask[] = [
  { id: 'd1', text: 'Retract all slide-outs and store lock bars', done: false },
  { id: 'd2', text: 'Retract hydraulic leveling jacks', done: false },
  { id: 'd3', text: 'Disconnect shore power cable, city water, and sewer hose', done: false },
  { id: 'd4', text: 'Turn off propane main valve at tank', done: false },
  { id: 'd5', text: 'Lower rooftop TV antenna & close ceiling vents', done: false },
  { id: 'd6', text: 'Check toad vehicle tow hitch pin & safety cables', done: false }
];

export const INITIAL_ARRIVAL_TASKS: ChecklistTask[] = [
  { id: 'a1', text: 'Check ground stability and chock wheels', done: false },
  { id: 'a2', text: 'Connect surge protector & test pedestal power before plugging in', done: false },
  { id: 'a3', text: 'Level the RV using automatic leveling system', done: false },
  { id: 'a4', text: 'Connect drinking water hose with pressure regulator', done: false },
  { id: 'a5', text: 'Attach sewer line with elbow adapter & check seals', done: false }
];
