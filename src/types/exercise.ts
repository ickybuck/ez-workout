export interface Exercise {
  id: string;
  name: string;
  description: string;
  equipment_type: { 
    id: string; 
    name: string;
    emoji: string;
  };
  body_part: { id: string; name: string };
  is_compound: boolean;
  is_plate_loaded: boolean;
  muscle_groups: Array<{
    muscle_group: { 
      id: string; 
      name: string;
      category: string;
      description: string;
    };
    is_primary: boolean;
  }>;
  defaults?: {
    id: string;
    sets: number;
    reps: number;
    weight: number;
    weight_increment: number;
    rep_increment?: number;
    bar_weight?: number;
    /**
     * Per-user, so hiding an exercise never affects anyone else's library.
     * Exercises are a shared catalogue and users cannot delete from it
     * (EZ-04); hiding is how someone tidies their own view of it.
     */
    hidden?: boolean;
  };
}

export interface EquipmentType {
  id: string;
  name: string;
  emoji: string;
}

export interface BodyPart {
  id: string;
  name: string;
}

export interface MuscleGroup {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface PlateConfiguration {
  plates: Array<{
    weight: number;
    count: number;
  }>;
  barWeight: number;
  totalWeight: number;
}
