import { describe, it, expect } from 'vitest';
import { changedSharedFields, sharedChangeWarning } from './exerciseSharing';

const base = {
  name: 'Leg Press',
  description: 'Sled',
  equipmentTypeId: 'eq-1',
  bodyPartId: 'bp-1',
  isCompound: true,
  isPlateLoaded: true,
  muscleGroups: [
    { id: 'quads', is_primary: true },
    { id: 'glutes', is_primary: false },
  ],
};

describe('changedSharedFields', () => {
  it('finds nothing when only the order of muscle groups differs', () => {
    expect(changedSharedFields(base, { ...base, muscleGroups: [...base.muscleGroups].reverse() })).toEqual([]);
  });

  it('ignores surrounding space and null versus empty', () => {
    expect(changedSharedFields({ ...base, description: null }, { ...base, description: '  ' })).toEqual([]);
    expect(changedSharedFields(base, { ...base, name: ' Leg Press ' })).toEqual([]);
  });

  it('names each shared field that changed', () => {
    expect(
      changedSharedFields(base, {
        ...base,
        name: 'Sled Leg Press',
        equipmentTypeId: 'eq-2',
        isPlateLoaded: false,
        muscleGroups: [{ id: 'quads', is_primary: true }],
      }),
    ).toEqual(['name', 'equipment', 'muscle groups', 'plate-loaded']);
  });

  it('treats a primary muscle becoming secondary as a change', () => {
    expect(
      changedSharedFields(base, {
        ...base,
        muscleGroups: [
          { id: 'quads', is_primary: false },
          { id: 'glutes', is_primary: false },
        ],
      }),
    ).toEqual(['muscle groups']);
  });
});

describe('sharedChangeWarning', () => {
  it('says it affects everyone and lists the fields', () => {
    const text = sharedChangeWarning('Leg Press', ['name', 'equipment', 'plate-loaded']);
    expect(text).toContain('name, equipment and plate-loaded');
    expect(text).toContain('for everyone who uses it');
  });
});
