import { CharacterPlaza, Plaza } from '@prisma/client';

type PlazaWithDetails = CharacterPlaza & { plaza: Plaza };

export class SkillRankValidator {
  
  // Jerarquía de rangos para comparaciones matemáticas
  private readonly RANK_VALUES: Record<string, number> = { "C": 1, "B": 2, "A": 3, "S": 4 };

  // Constantes Inmutables del Lore
  private readonly INTON_KEYWORDS = ["Inton", "Iryoninjutsu", "Genjutsu"];
  private readonly BASIC_ELEMENTS = ["Katon", "Suiton", "Doton", "Fuuton", "Raiton"];
  
  public validateRankUpgrade(
    characterPlazas: PlazaWithDetails[], 
    targetPlaza: Plaza, 
    newRank: string
  ): boolean {
    
    const newRankValue = this.RANK_VALUES[newRank.toUpperCase()];
    if (!newRankValue) throw new Error("Rango de habilidad inválido.");

    const intonSkills = characterPlazas.filter(cp => this.isInton(cp.plaza.name));
    const allElements = characterPlazas.filter(cp => cp.plaza.category === "Elemento");
    const basicElements = allElements.filter(cp => this.isBasicElement(cp.plaza.name));
    
    const isTargetInton = this.isInton(targetPlaza.name);
    const isTargetElement = targetPlaza.category === "Elemento";
    const isTargetBasicElement = this.isBasicElement(targetPlaza.name);

    // ==========================================
    // 🛑 REGLA 1: INTON VS CUALQUIER ELEMENTO
    // ==========================================
    if (isTargetInton) {
      const maxElementRank = this.getMaxRank(allElements); // Revisa avanzados y básicos
      
      // Intentan subir Inton a A o S (Valor >= 3)
      if (newRankValue >= 3 && maxElementRank > 0) {
         throw new Error(`⛔ LÍMITE INTON: No puedes subir ${targetPlaza.name} a Rango ${newRank} porque posees Naturalezas Elementales.`);
      }
      // Intentan subir Inton a B o C (Valor <= 2)
      if (newRankValue <= 2 && maxElementRank > 1) { // 1 es Rango C
         throw new Error(`⛔ LÍMITE INTON: Para desarrollar el Inton, tus elementos no pueden superar el Rango C.`);
      }
    }

    if (isTargetElement) {
      const maxIntonRank = this.getMaxRank(intonSkills);

      // Intentan subir un Elemento (Avanzado o Básico) a B, A o S (Valor >= 2)
      if (newRankValue >= 2 && maxIntonRank > 0) {
        throw new Error(`⛔ LÍMITE ELEMENTAL: Desarrollar ${targetPlaza.name} a Rango ${newRank} es incompatible con el uso del Inton.`);
      }
      // Intentan subir un Elemento a C (Valor = 1)
      if (newRankValue === 1 && maxIntonRank >= 3) { // 3 es Rango A
        throw new Error(`⛔ LÍMITE ELEMENTAL: Tu dominio del Inton en Rango Avanzado te impide desarrollar Naturalezas Elementales.`);
      }
    }

    // ==========================================
    // 🛑 REGLA 2: MÚLTIPLES ELEMENTOS BÁSICOS
    // ==========================================
    if (isTargetBasicElement) {
      // Excluimos la habilidad que estamos intentando subir para medir "al resto"
      const otherBasicElements = basicElements.filter(cp => cp.plaza.id !== targetPlaza.id);
      const otherBasicMax = this.getMaxRank(otherBasicElements);

      // Regla: Subir a S -> Ningún otro puede ser S o A (Máximo permitido es B = 2)
      if (newRankValue === 4 && otherBasicMax > 2) {
        throw new Error(`⛔ LÍMITE ELEMENTAL: Para tener un Elemento Básico en Rango S, los demás no pueden superar el Rango B.`);
      }

      // Regla: Subir a A -> Ningún otro puede ser S (Máximo permitido es A = 3, todos en A es legal)
      if (newRankValue === 3 && otherBasicMax === 4) {
        throw new Error(`⛔ LÍMITE ELEMENTAL: Ya posees un Elemento en Rango S. Los demás no pueden alcanzar el Rango A.`);
      }
    }

    return true; 
  }

  // --- HELPERS PRIVADOS ---
  private isInton(name: string): boolean {
    // Si la habilidad incluye la palabra en su nombre, es Inton
    return this.INTON_KEYWORDS.some(kw => name.includes(kw));
  }

  private isBasicElement(name: string): boolean {
    // Solo Katon, Suiton, Doton, Fuuton, Raiton son elementales básicos
    return this.BASIC_ELEMENTS.some(kw => name.includes(kw));
  }

  private getMaxRank(plazas: PlazaWithDetails[]): number {
    if (plazas.length === 0) return 0;
    return Math.max(...plazas.map(cp => this.RANK_VALUES[cp.currentRank.toUpperCase()] || 0));
  }
}