export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_hidden: boolean;
  is_favorite: boolean;
  template_type: 'regular' | 'superset';
  category: 'Upper Body' | 'Lower Body' | 'Core Focused' | 'Whole Body';
  created_at: string;
  updated_at: string;
  exercises: TemplateExercise[];
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    equipment_type: {
      id: string;
      name: string;
    };
    is_compound: boolean;
    muscle_groups: Array<{
      muscle_group: {
        id: string;
        name: string;
        category: string;
      };
      is_primary: boolean;
    }>;
  };
}