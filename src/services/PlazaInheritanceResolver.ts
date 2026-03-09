import { PrismaClient } from '@prisma/client';
import { normalizeRestrictedCategory, type RestrictedTraitCategory } from './TraitRuleService';

export interface RestrictedInheritedTrait {
  name: string;
  category: RestrictedTraitCategory;
  source: 'herencia';
  sourcePlaza: string;
}

export interface ResolvedPlazaInheritance {
  autoGrantedTraitNames: Set<string>;
  autoGrantedPlazaNames: Set<string>;
  autoGrantedTraitSource: Map<string, string>;
  inheritedRestrictedTraits: RestrictedInheritedTrait[];
}

export async function resolvePlazaInheritance(
  prisma: PrismaClient,
  selectedPlazas: Array<{ id: string; name: string }>
): Promise<ResolvedPlazaInheritance> {
  const autoGrantedTraitNames = new Set<string>();
  const autoGrantedPlazaNames = new Set<string>();
  const autoGrantedTraitSource = new Map<string, string>();
  const inheritedRestrictedTraits: RestrictedInheritedTrait[] = [];

  if (selectedPlazas.length === 0) {
    return {
      autoGrantedTraitNames,
      autoGrantedPlazaNames,
      autoGrantedTraitSource,
      inheritedRestrictedTraits
    };
  }

  const visitedPlazaIds = new Set<string>();
  const queue = selectedPlazas.map((plaza) => ({ id: plaza.id, sourcePlazaName: plaza.name }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visitedPlazaIds.has(current.id)) {
      continue;
    }
    visitedPlazaIds.add(current.id);

    const plaza = await prisma.plaza.findUnique({
      where: { id: current.id },
      include: {
        inheritedTraits: { include: { trait: { select: { name: true, category: true } } } },
        inheritedPlazas: { include: { child: { select: { id: true, name: true } } } }
      }
    });

    if (!plaza) {
      continue;
    }

    for (const inheritedTrait of plaza.inheritedTraits) {
      autoGrantedTraitNames.add(inheritedTrait.trait.name);
      if (!autoGrantedTraitSource.has(inheritedTrait.trait.name)) {
        autoGrantedTraitSource.set(inheritedTrait.trait.name, current.sourcePlazaName);
      }

      const restrictedCategory = normalizeRestrictedCategory(inheritedTrait.trait.category);
      if (restrictedCategory) {
        inheritedRestrictedTraits.push({
          name: inheritedTrait.trait.name,
          category: restrictedCategory,
          source: 'herencia',
          sourcePlaza: current.sourcePlazaName
        });
      }
    }

    for (const inheritedPlaza of plaza.inheritedPlazas) {
      autoGrantedPlazaNames.add(inheritedPlaza.child.name);
      if (!visitedPlazaIds.has(inheritedPlaza.child.id)) {
        queue.push({ id: inheritedPlaza.child.id, sourcePlazaName: current.sourcePlazaName });
      }
    }
  }

  return {
    autoGrantedTraitNames,
    autoGrantedPlazaNames,
    autoGrantedTraitSource,
    inheritedRestrictedTraits
  };
}
