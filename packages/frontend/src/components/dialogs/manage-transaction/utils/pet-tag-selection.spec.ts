import { getPetTagIds, getSelectedPetTagId, replaceSelectedPetTag } from './pet-tag-selection';

const tags = [
  { id: 'luna', description: 'MONETRA_PET:luna' },
  { id: 'thor', description: 'MONETRA_PET:thor' },
  { id: 'both', description: 'MONETRA_PET:both' },
  { id: 'need', description: null },
];

describe('pet tag selection', () => {
  it('recognizes only household pet tags', () => {
    expect(getPetTagIds(tags)).toEqual(['luna', 'thor', 'both']);
  });

  it('resolves the selected pet tag from a transaction tag list', () => {
    expect(getSelectedPetTagId({ tagIds: ['need', 'thor'], tags })).toBe('thor');
    expect(getSelectedPetTagId({ tagIds: ['need'], tags })).toBeNull();
  });

  it('replaces the pet selection without dropping ordinary tags', () => {
    expect(
      replaceSelectedPetTag({
        tagIds: ['need', 'luna'],
        tags,
        selectedTagId: 'thor',
      }),
    ).toEqual(['need', 'thor']);
  });

  it('does not add a non-pet or unknown tag as an animal selection', () => {
    expect(
      replaceSelectedPetTag({
        tagIds: ['need', 'luna'],
        tags,
        selectedTagId: 'need',
      }),
    ).toEqual(['need']);

    expect(
      replaceSelectedPetTag({
        tagIds: ['need', 'luna'],
        tags,
        selectedTagId: 'unknown',
      }),
    ).toEqual(['need']);
  });

  it('clears only the pet selection', () => {
    expect(
      replaceSelectedPetTag({
        tagIds: ['need', 'luna'],
        tags,
        selectedTagId: null,
      }),
    ).toEqual(['need']);
  });
});
