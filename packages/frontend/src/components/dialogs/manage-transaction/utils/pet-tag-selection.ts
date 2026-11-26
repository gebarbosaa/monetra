type PetTagIdentity = {
  id: string;
  description: string | null;
};

export const PET_TAG_DESCRIPTION_PREFIX = 'MONETRA_PET:';

export const getPetTagIds = (tags: PetTagIdentity[]): string[] =>
  tags.filter((tag) => tag.description?.startsWith(PET_TAG_DESCRIPTION_PREFIX)).map((tag) => tag.id);

export const getSelectedPetTagId = ({
  tagIds,
  tags,
}: {
  tagIds: string[];
  tags: PetTagIdentity[];
}): string | null => {
  const petTagIds = new Set(getPetTagIds(tags));
  return tagIds.find((id) => petTagIds.has(id)) ?? null;
};

/** Replace the household animal marker while preserving every unrelated transaction tag. */
export const replaceSelectedPetTag = ({
  tagIds,
  tags,
  selectedTagId,
}: {
  tagIds: string[];
  tags: PetTagIdentity[];
  selectedTagId: string | null;
}): string[] => {
  const petTagIds = new Set(getPetTagIds(tags));
  const otherTagIds = tagIds.filter((id) => !petTagIds.has(id));
  return selectedTagId ? [...otherTagIds, selectedTagId] : otherTagIds;
};
