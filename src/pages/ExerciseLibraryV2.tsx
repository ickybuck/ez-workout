import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Edit2, Plus, Trash2, ListPlus, Check, X, Filter, Copy, Search, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Exercise } from '../types/exercise';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { useExerciseData } from '../hooks/useExerciseData';
import AddToTemplateDialog from '../components/exercises/AddToTemplateDialog';

type SortField = 'name' | 'weight' | 'sets' | 'reps' | 'templates';
type SortOrder = 'asc' | 'desc';

interface Filters {
  bodyPart: string;
  equipment: string;
  inTemplates: 'all' | 'used' | 'unused';
  compound: 'all' | 'compound' | 'isolated';
  showHidden: boolean;
}

interface ExerciseWithTemplateCount extends Exercise {
  templateCount: number;
}

const ExerciseLibraryV2: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useAdminStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatWeight } = useWeightUnit();
  const {
    exercises,
    equipmentTypes,
    bodyParts,
    loading,
    loadExerciseData,
  } = useExerciseData();

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exercisesWithTemplates, setExercisesWithTemplates] = useState<ExerciseWithTemplateCount[]>([]);
  
  // Initialize filters from URL params
  const [search, setSearch] = useState(() => searchParams.get('q') || '');

  const [showFilters, setShowFilters] = useState(() => {
    return searchParams.get('showFilters') === 'true';
  });
  
  const [filters, setFilters] = useState<Filters>(() => ({
    bodyPart: searchParams.get('bodyPart') || '',
    equipment: searchParams.get('equipment') || '',
    inTemplates: (searchParams.get('inTemplates') as 'all' | 'used' | 'unused') || 'all',
    compound: (searchParams.get('compound') as 'all' | 'compound' | 'isolated') || 'all',
    showHidden: searchParams.get('showHidden') === 'true',
  }));
  
  const [sortConfig, setSortConfig] = useState<{field: SortField; order: SortOrder}>(() => ({
    field: (searchParams.get('sortField') as SortField) || 'name',
    order: (searchParams.get('sortOrder') as SortOrder) || 'asc'
  }));

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (showFilters) params.set('showFilters', 'true');
    if (search.trim()) params.set('q', search.trim());
    if (filters.bodyPart) params.set('bodyPart', filters.bodyPart);
    if (filters.equipment) params.set('equipment', filters.equipment);
    if (filters.inTemplates !== 'all') params.set('inTemplates', filters.inTemplates);
    if (filters.compound !== 'all') params.set('compound', filters.compound);
    if (filters.showHidden) params.set('showHidden', 'true');
    if (sortConfig.field !== 'name') params.set('sortField', sortConfig.field);
    if (sortConfig.order !== 'asc') params.set('sortOrder', sortConfig.order);
    
    setSearchParams(params, { replace: true });
  }, [showFilters, filters, sortConfig, search, setSearchParams]);

  useEffect(() => {
    if (exercises.length > 0) {
      loadTemplateUsage();
    }
  }, [exercises]);

  const loadTemplateUsage = async () => {
    try {
      const { data: templateCounts, error } = await supabase
        .from('template_exercises')
        .select('exercise_id')
        .in('exercise_id', exercises.map(e => e.id));

      if (error) throw error;

      const counts = templateCounts.reduce((acc, te) => {
        acc[te.exercise_id] = (acc[te.exercise_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const exercisesWithCounts = exercises.map(exercise => ({
        ...exercise,
        templateCount: counts[exercise.id] || 0,
      }));

      setExercisesWithTemplates(exercisesWithCounts);
    } catch (error) {
      console.error('Error loading template usage:', error);
    }
  };

  const handleToggleHidden = async (exercise: ExerciseWithTemplateCount) => {
    if (!user) return;
    const nowHidden = !exercise.defaults?.hidden;

    try {
      // Update first, insert only if nothing matched.
      //
      // An upsert would be shorter but wrong: Supabase writes every column it
      // is given on conflict, so a row created here would carry null sets and
      // reps, and passing real defaults to avoid that would clobber the user's
      // existing configuration whenever they un-hid something.
      //
      // Note the explicit row count. An update matching zero rows succeeds
      // silently — that is the whole substance of EZ-02, and it is exactly
      // what would happen here for an exercise the user has never configured.
      const { data: updated, error: updateError } = await supabase
        .from('exercise_defaults')
        .update({ hidden: nowHidden })
        .eq('exercise_id', exercise.id)
        .eq('user_id', user.id)
        .select('id');

      if (updateError) throw updateError;

      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
          .from('exercise_defaults')
          .insert({
            exercise_id: exercise.id,
            user_id: user.id,
            hidden: nowHidden,
            // Match what ExerciseAdd seeds, so a row created purely by hiding
            // is not distinguishable from one created deliberately.
            sets: 3,
            reps: 10,
            weight: 0,
            weight_increment: 2.3,
          });

        if (insertError) throw insertError;
      }

      toast.success(nowHidden ? `${exercise.name} hidden` : `${exercise.name} restored`);
      await loadExerciseData();
    } catch (error) {
      console.error('Error toggling exercise visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return;

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Exercise deleted successfully');
      await loadExerciseData();
    } catch (error) {
      console.error('Error deleting exercise:', error);
      toast.error('Failed to delete exercise');
    }
  };

  const handleCopyExercise = async (exercise: Exercise) => {
    if (!user) return;

    try {
      const { data: newExercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          name: `${exercise.name} (Copy)`,
          description: exercise.description,
          equipment_type_id: exercise.equipment_type?.id,
          body_part_id: exercise.body_part?.id,
          is_compound: exercise.is_compound,
          is_plate_loaded: exercise.is_plate_loaded,
        })
        .select()
        .single();

      if (exerciseError) throw exerciseError;

      const { error: defaultsError } = await supabase
        .from('exercise_defaults')
        .insert({
          exercise_id: newExercise.id,
          user_id: user.id,
          sets: exercise.defaults?.sets || 3,
          reps: exercise.defaults?.reps || 10,
          weight: exercise.defaults?.weight || 0,
          weight_increment: exercise.defaults?.weight_increment || 2.3,
          bar_weight: exercise.defaults?.bar_weight || 20,
        });

      if (defaultsError) throw defaultsError;

      if (exercise.muscle_groups?.length > 0) {
        const { error: muscleGroupError } = await supabase
          .from('exercise_muscle_groups')
          .insert(
            exercise.muscle_groups.map(mg => ({
              exercise_id: newExercise.id,
              muscle_group_id: mg.muscle_group.id,
              is_primary: mg.is_primary,
            }))
          );

        if (muscleGroupError) throw muscleGroupError;
      }

      toast.success('Exercise copied successfully');
      
      navigate(`/dashboard/exercises/${newExercise.id}/edit`);
    } catch (error) {
      console.error('Error copying exercise:', error);
      toast.error('Failed to copy exercise');
    }
  };

  const updateFilters = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const toggleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.order === 'asc' ? '↑' : '↓';
  };

  const hiddenCount = exercisesWithTemplates.filter((e) => e.defaults?.hidden).length;

  const filteredAndSortedExercises = exercisesWithTemplates
    .filter(exercise => {
      // Substring rather than fuzzy, deliberately. "Incline Bench Press" and
      // "Bench Press" are different exercises, as are "Hack Squats" and
      // "Squats" — all four are in the catalogue, and a fuzzy match would
      // flag them as duplicates of each other on day one.
      // Hidden exercises stay out of the way unless asked for. Searching
      // still finds them, so someone cannot hide something and then be unable
      // to work out why it will not come back.
      if (!filters.showHidden && exercise.defaults?.hidden && !search.trim()) return false;
      const query = search.trim().toLowerCase();
      if (query && !exercise.name.toLowerCase().includes(query)) return false;
      if (filters.bodyPart && exercise.body_part?.id !== filters.bodyPart) return false;
      if (filters.equipment && exercise.equipment_type?.id !== filters.equipment) return false;
      if (filters.inTemplates === 'used' && exercise.templateCount === 0) return false;
      if (filters.inTemplates === 'unused' && exercise.templateCount > 0) return false;
      if (filters.compound === 'compound' && !exercise.is_compound) return false;
      if (filters.compound === 'isolated' && exercise.is_compound) return false;
      return true;
    })
    .sort((a, b) => {
      const order = sortConfig.order === 'asc' ? 1 : -1;
      switch (sortConfig.field) {
        case 'name':
          return a.name.localeCompare(b.name) * order;
        case 'weight':
          return ((a.defaults?.weight || 0) - (b.defaults?.weight || 0)) * order;
        case 'sets':
          return ((a.defaults?.sets || 0) - (b.defaults?.sets || 0)) * order;
        case 'reps':
          return ((a.defaults?.reps || 0) - (b.defaults?.reps || 0)) * order;
        case 'templates':
          return (a.templateCount - b.templateCount) * order;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div className="bg-white rounded-lg shadow-md p-3">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Exercise Library</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-full ${
                showFilters ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
              title="Toggle filters"
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1 max-w-xs ml-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises"
              aria-label="Search exercises"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Part</label>
                <select
                  value={filters.bodyPart}
                  onChange={(e) => updateFilters({ bodyPart: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">All</option>
                  {bodyParts.map(part => (
                    <option key={part.id} value={part.id}>{part.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
                <select
                  value={filters.equipment}
                  onChange={(e) => updateFilters({ equipment: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">All</option>
                  {equipmentTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Usage</label>
                <select
                  value={filters.inTemplates}
                  onChange={(e) => updateFilters({ inTemplates: e.target.value as 'all' | 'used' | 'unused' })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="all">All</option>
                  <option value="used">Used in Templates</option>
                  <option value="unused">Not Used</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={filters.compound}
                  onChange={(e) => updateFilters({ compound: e.target.value as 'all' | 'compound' | 'isolated' })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="all">All</option>
                  <option value="compound">Compound</option>
                  <option value="isolated">Isolated</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.showHidden}
                  onChange={(e) => updateFilters({ showHidden: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Show hidden exercises
                {hiddenCount > 0 && (
                  <span className="text-gray-400">({hiddenCount})</span>
                )}
              </label>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t">
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { field: 'name', label: 'Name' },
                  { field: 'weight', label: 'Weight' },
                  { field: 'sets', label: 'Sets' },
                  { field: 'reps', label: 'Reps' },
                  { field: 'templates', label: 'Templates' },
                ].map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field as SortField)}
                    className={`px-3 py-1 rounded text-sm ${
                      sortConfig.field === field
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label} {getSortIcon(field as SortField)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {filteredAndSortedExercises.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {search.trim()
                ? `No exercises match "${search.trim()}"`
                : 'No exercises found matching your filters'}
            </div>
          ) : (
            filteredAndSortedExercises.map((exercise) => (
              <div
                key={exercise.id}
                className={`border rounded-lg p-3 hover:shadow-md transition-shadow duration-200 ${
                  exercise.defaults?.hidden ? 'opacity-60 bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {exercise.name}
                  </h3>
                  <span className="text-xl" title={exercise.equipment_type?.name || 'No equipment'}>
                    {exercise.equipment_type?.emoji || '🏋️'}
                  </span>
                  {exercise.is_compound && (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Compound
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-baseline">
                      <span className="tabular-nums font-medium text-gray-900">
                        {exercise.defaults?.sets || 3}
                      </span>
                      <span className="text-gray-500 text-xs uppercase">s</span>
                      <span className="text-gray-400 mx-0.5">×</span>
                      <span className="tabular-nums font-medium text-gray-900">
                        {exercise.defaults?.reps || 10}
                      </span>
                      <span className="text-gray-500 text-xs uppercase">r</span>
                    </div>
                    <span className="text-gray-900">{formatWeight(exercise.defaults?.weight || 0)}</span>
                    {exercise.templateCount > 0 ? (
                      <div className="flex items-center gap-1 text-green-600" title="Used in templates">
                        <Check className="h-4 w-4" />
                        <span className="text-xs">{exercise.templateCount}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-500" title="Not used in any template">
                        <X className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedExercise(exercise)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                      title="Add to template"
                    >
                      <ListPlus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/dashboard/exercises/${exercise.id}/edit`)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                      title="Edit exercise"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleCopyExercise(exercise)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                      title="Copy exercise"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleHidden(exercise)}
                      className={`p-1.5 rounded-full ${
                        exercise.defaults?.hidden
                          ? 'text-indigo-600 hover:bg-indigo-50'
                          : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                      title={exercise.defaults?.hidden ? 'Show in my library' : 'Hide from my library'}
                    >
                      {exercise.defaults?.hidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    {isAdmin && (
                    <button
                      onClick={() => handleDelete(exercise.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                      title="Delete exercise"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {isAdmin && (
            <div className="pt-4 mt-2 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500 mb-2">
                {search.trim()
                  ? `Not what you were looking for?`
                  : 'Searched and it is genuinely not here?'}
              </p>
              <button
                onClick={() =>
                  navigate(
                    search.trim()
                      ? `/dashboard/exercises/new?name=${encodeURIComponent(search.trim())}`
                      : '/dashboard/exercises/new',
                  )
                }
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                {search.trim() ? `Create "${search.trim()}"` : 'Create a new exercise'}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedExercise && (
        <AddToTemplateDialog
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
          onUpdate={() => {
            loadTemplateUsage();
          }}
        />
      )}
    </div>
  );
};

export default ExerciseLibraryV2;