import { supabase } from './supabase';
import { toast } from 'sonner';

interface ImportedExercise {
  name: string;
  description: string;
  equipmentType: string;
  equipmentEmoji: string;
  bodyPart: string;
  isCompound: boolean;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

export const importExercises = async (file: File) => {
  try {
    const text = await file.text();
    
    // Basic file validation
    if (!text.trim()) {
      toast.error('The CSV file is empty');
      return false;
    }

    // Split into rows, handling both \r\n and \n
    const rows = text.split(/\r?\n/).map(row => {
      // Handle quoted values with commas
      const matches = [];
      let field = '';
      let inQuotes = false;
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        
        if (char === ',' && !inQuotes) {
          matches.push(field.trim());
          field = '';
          continue;
        }
        
        field += char;
      }
      
      // Add the last field
      matches.push(field.trim());
      
      return matches;
    }).filter(row => row.length > 0 && row.some(cell => cell.trim()));

    // Validate header row
    const expectedHeaders = [
      'Name',
      'Description',
      'Equipment Type',
      'Equipment Emoji',
      'Body Part',
      'Is Compound',
      'Primary Muscles',
      'Secondary Muscles'
    ];

    const headerRow = rows[0] || [];
    const hasValidHeaders = expectedHeaders.every((header, index) => {
      const cellValue = headerRow[index]?.toLowerCase().trim();
      const expectedValue = header.toLowerCase();
      return cellValue === expectedValue;
    });

    if (!hasValidHeaders) {
      console.error('Invalid headers:', headerRow);
      toast.error('Invalid CSV format. Please use the template from the export function.');
      return false;
    }

    // Remove header row and empty rows
    const dataRows = rows.slice(1).filter(row => row.length >= 8);

    if (dataRows.length === 0) {
      toast.error('No exercises found in the CSV file');
      return false;
    }

    // Parse CSV data into exercise objects with validation
    const exercises: ImportedExercise[] = [];
    const invalidRows: { row: number; errors: string[] }[] = [];

    dataRows.forEach((row, index) => {
      const errors: string[] = [];

      // Validate required fields
      if (!row[0]?.trim()) errors.push('Name is required');
      if (!row[2]?.trim()) errors.push('Equipment Type is required');
      if (!row[4]?.trim()) errors.push('Body Part is required');

      // If there are validation errors, add to invalid rows
      if (errors.length > 0) {
        invalidRows.push({ row: index + 2, errors }); // +2 for header row and 1-based indexing
      } else {
        // Add valid exercise
        exercises.push({
          name: row[0].trim(),
          description: row[1]?.trim() || '',
          equipmentType: row[2].trim(),
          equipmentEmoji: row[3]?.trim() || '⚙️',
          bodyPart: row[4].trim(),
          isCompound: row[5]?.trim().toUpperCase() === 'TRUE',
          primaryMuscles: row[6]?.split(';').map(m => m.trim()).filter(Boolean) || [],
          secondaryMuscles: row[7]?.split(';').map(m => m.trim()).filter(Boolean) || [],
        });
      }
    });

    // Report validation errors if any
    if (invalidRows.length > 0) {
      console.error('Invalid rows:', invalidRows);
      toast.error(
        `Found ${invalidRows.length} invalid rows. Check the console for details.`,
        { duration: 5000 }
      );
      return false;
    }

    if (exercises.length === 0) {
      toast.error('No valid exercises found in the CSV file');
      return false;
    }

    // Get or create equipment types
    for (const exercise of exercises) {
      // Get or create equipment type
      const { data: equipmentType, error: equipmentError } = await supabase
        .from('equipment_types')
        .select('id')
        .eq('name', exercise.equipmentType)
        .maybeSingle();

      if (equipmentError) throw equipmentError;

      if (!equipmentType) {
        // Create new equipment type
        const { data: newEquipmentType, error: createEquipmentError } = await supabase
          .from('equipment_types')
          .insert({
            name: exercise.equipmentType,
            emoji: exercise.equipmentEmoji,
          })
          .select('id')
          .single();

        if (createEquipmentError) throw createEquipmentError;
      }

      // Get or create body part
      const { data: bodyPart, error: bodyPartError } = await supabase
        .from('body_parts')
        .select('id')
        .eq('name', exercise.bodyPart)
        .maybeSingle();

      if (bodyPartError) throw bodyPartError;

      if (!bodyPart) {
        // Create new body part
        const { data: newBodyPart, error: createBodyPartError } = await supabase
          .from('body_parts')
          .insert({
            name: exercise.bodyPart,
          })
          .select('id')
          .single();

        if (createBodyPartError) throw createBodyPartError;
      }
    }

    // Get all equipment types and body parts
    const { data: equipmentTypes, error: equipmentError } = await supabase
      .from('equipment_types')
      .select('id, name');
    if (equipmentError) throw equipmentError;

    const { data: bodyParts, error: bodyPartError } = await supabase
      .from('body_parts')
      .select('id, name');
    if (bodyPartError) throw bodyPartError;

    const { data: muscleGroups, error: muscleError } = await supabase
      .from('muscle_groups')
      .select('id, name');
    if (muscleError) throw muscleError;

    // Create exercises and their relationships
    for (const exercise of exercises) {
      // Find IDs
      const equipmentType = equipmentTypes.find(et => et.name === exercise.equipmentType);
      const bodyPart = bodyParts.find(bp => bp.name === exercise.bodyPart);

      if (!equipmentType || !bodyPart) {
        console.error(`Missing equipment type or body part for exercise: ${exercise.name}`);
        continue;
      }

      // Create or update exercise
      const { data: existingExercise, error: checkError } = await supabase
        .from('exercises')
        .select('id')
        .eq('name', exercise.name)
        .maybeSingle();

      if (checkError) throw checkError;

      let exerciseId: string;

      if (existingExercise) {
        // Update existing exercise
        const { error: updateError } = await supabase
          .from('exercises')
          .update({
            description: exercise.description,
            equipment_type_id: equipmentType.id,
            body_part_id: bodyPart.id,
            is_compound: exercise.isCompound,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingExercise.id);

        if (updateError) throw updateError;
        exerciseId = existingExercise.id;
      } else {
        // Create new exercise
        const { data: newExercise, error: createError } = await supabase
          .from('exercises')
          .insert({
            name: exercise.name,
            description: exercise.description,
            equipment_type_id: equipmentType.id,
            body_part_id: bodyPart.id,
            is_compound: exercise.isCompound,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        exerciseId = newExercise.id;
      }

      // Delete existing muscle group associations
      const { error: deleteError } = await supabase
        .from('exercise_muscle_groups')
        .delete()
        .eq('exercise_id', exerciseId);

      if (deleteError) throw deleteError;

      // Create muscle group associations
      const muscleGroupAssociations = [
        ...exercise.primaryMuscles.map(name => ({
          exercise_id: exerciseId,
          muscle_group_id: muscleGroups.find(mg => mg.name === name)?.id,
          is_primary: true,
        })),
        ...exercise.secondaryMuscles.map(name => ({
          exercise_id: exerciseId,
          muscle_group_id: muscleGroups.find(mg => mg.name === name)?.id,
          is_primary: false,
        })),
      ].filter(mg => mg.muscle_group_id); // Filter out any muscles that weren't found

      if (muscleGroupAssociations.length > 0) {
        const { error: insertError } = await supabase
          .from('exercise_muscle_groups')
          .insert(muscleGroupAssociations);

        if (insertError) throw insertError;
      }
    }

    toast.success(`Successfully imported ${exercises.length} exercises`);
    return true;
  } catch (error) {
    console.error('Error importing exercises:', error);
    toast.error('Failed to import exercises');
    return false;
  }
};