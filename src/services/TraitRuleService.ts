export const RESTRICTED_TRAIT_CATEGORIES = ['origen', 'nacimiento', 'moral'] as const;

export type RestrictedTraitCategory = typeof RESTRICTED_TRAIT_CATEGORIES[number];

export interface NamedCategorizedTrait {
  name: string;
  category: string;
}

export function normalizeCategory(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeRestrictedCategory(category: string): RestrictedTraitCategory | null {
  const normalized = normalizeCategory(category);
  if (RESTRICTED_TRAIT_CATEGORIES.includes(normalized as RestrictedTraitCategory)) {
    return normalized as RestrictedTraitCategory;
  }
  return null;
}

export function getCategoryLabel(category: RestrictedTraitCategory): string {
  const labels: Record<RestrictedTraitCategory, string> = {
    origen: 'Origen',
    nacimiento: 'Nacimiento',
    moral: 'Moral'
  };

  return labels[category];
}

export function assertRestrictedCategoryUniqueness(
  traits: NamedCategorizedTrait[],
  buildError?: (category: RestrictedTraitCategory, names: string[]) => string
): void {
  const grouped = new Map<RestrictedTraitCategory, string[]>();

  for (const trait of traits) {
    const normalizedCategory = normalizeRestrictedCategory(trait.category);
    if (!normalizedCategory) {
      continue;
    }

    const current = grouped.get(normalizedCategory) ?? [];
    current.push(trait.name);
    grouped.set(normalizedCategory, current);
  }

  for (const [category, names] of grouped.entries()) {
    if (names.length > 1) {
      if (buildError) {
        throw new Error(buildError(category, names));
      }

      throw new Error(
        `⛔ CONFLICTO DE CATEGORIA: Solo puedes tener un rasgo de '${getCategoryLabel(category)}'. Encontrados: ${names.join(', ')}.`
      );
    }
  }
}

export function assertRestrictedCategoryAvailable(
  existingTraits: NamedCategorizedTrait[],
  incomingTrait: NamedCategorizedTrait,
  buildError?: (category: RestrictedTraitCategory, existingName: string, incomingName: string) => string
): void {
  const incomingCategory = normalizeRestrictedCategory(incomingTrait.category);
  if (!incomingCategory) {
    return;
  }

  const existing = existingTraits.find((trait) => normalizeRestrictedCategory(trait.category) === incomingCategory);
  if (!existing) {
    return;
  }

  if (buildError) {
    throw new Error(buildError(incomingCategory, existing.name, incomingTrait.name));
  }

  throw new Error(
    `⛔ CONFLICTO DE CATEGORIA: '${incomingTrait.name}' no puede asignarse porque ya tienes '${existing.name}' en '${getCategoryLabel(incomingCategory)}'.`
  );
}
