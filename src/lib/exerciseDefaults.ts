import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type DefaultsRow = Database['public']['Tables']['exercise_defaults']['Insert'];
export type MyExerciseDefaults = Omit<DefaultsRow, 'id' | 'exercise_id' | 'user_id' | 'created_at' | 'updated_at'>;

/**
 * Save the signed-in person's own settings for one exercise (bar weight,
 * weight, increments ...).
 *
 * An upsert, never a plain update: a person has no exercise_defaults row for
 * an exercise until something creates one, and an update of a row that does
 * not exist changes nothing and returns no error. That is how Marilyn's bar
 * weight on Split Squats kept "saving" and springing back to 45 lb -- she had
 * no row for 21 of the 25 exercises in her templates.
 *
 * Only the fields given are sent, so an existing row keeps everything else and
 * a new row takes the column defaults for the rest.
 */
export async function saveMyExerciseDefaults(
  client: SupabaseClient<Database>,
  exerciseId: string,
  fields: MyExerciseDefaults,
): Promise<void> {
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await client
    .from('exercise_defaults')
    .upsert(
      { ...fields, exercise_id: exerciseId, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'exercise_id,user_id' },
    );
  if (error) throw error;
}
