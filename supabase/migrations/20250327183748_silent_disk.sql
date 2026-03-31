-- Drop existing policies
DROP POLICY IF EXISTS "Exercise muscle groups are publicly readable" ON exercise_muscle_groups;
DROP POLICY IF EXISTS "Users can modify exercise muscle groups" ON exercise_muscle_groups;

-- Create new policy for all operations
CREATE POLICY "Users can modify exercise muscle groups"
ON exercise_muscle_groups
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE exercise_muscle_groups ENABLE ROW LEVEL SECURITY;