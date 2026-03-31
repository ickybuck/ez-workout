import { supabase } from './supabase';
import { toast } from 'sonner';

interface Exercise {
  id: string;
  name: string;
  description: string | null;
  equipment_type: {
    name: string;
    emoji: string;
  };
  body_part: {
    name: string;
  };
  is_compound: boolean;
  muscle_groups: Array<{
    muscle_group: {
      name: string;
      category: string;
    };
    is_primary: boolean;
  }>;
}

export const exportExercises = async () => {
  try {
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select(`
        id,
        name,
        description,
        equipment_type:equipment_type_id(name, emoji),
        body_part:body_part_id(name),
        is_compound,
        muscle_groups:exercise_muscle_groups(
          muscle_group:muscle_group_id(name, category),
          is_primary
        )
      `);

    if (error) throw error;

    // Convert exercises to CSV format
    const csvRows = [
      // Header row
      [
        'Name',
        'Description',
        'Equipment Type',
        'Equipment Emoji',
        'Body Part',
        'Is Compound',
        'Primary Muscles',
        'Secondary Muscles',
      ].join(','),
      // Data rows
      ...exercises.map((exercise: Exercise) => [
        `"${exercise.name}"`,
        `"${exercise.description || ''}"`,
        `"${exercise.equipment_type.name}"`,
        `"${exercise.equipment_type.emoji}"`,
        `"${exercise.body_part.name}"`,
        exercise.is_compound ? 'TRUE' : 'FALSE',
        `"${exercise.muscle_groups
          .filter(mg => mg.is_primary)
          .map(mg => mg.muscle_group.name)
          .join('; ')}"`,
        `"${exercise.muscle_groups
          .filter(mg => !mg.is_primary)
          .map(mg => mg.muscle_group.name)
          .join('; ')}"`,
      ].join(','))
    ].join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'exercises.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Exercises exported successfully');
    return true;
  } catch (error) {
    console.error('Error exporting exercises:', error);
    toast.error('Failed to export exercises');
    return false;
  }
};