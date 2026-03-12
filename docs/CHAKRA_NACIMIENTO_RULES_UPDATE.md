# Chakra + Nacimiento Rules Update

**Date:** March 9, 2026
**Status:** Implemented and validated (`npm run build` OK)

---

## Objective

Align stat behavior with official rol rules:

1. Chakra must be displayed as `scale/cap (+external)`.
2. Chakra plaza bonuses are external display bonuses and must not inflate the Chakra scale numerator.
3. Nacimiento trait stat effects must be modeled as `gradations` (scale index shifts), not as flat ad-hoc stat points.

---

## Final Mechanics

### Chakra

- Base formula: `2 + (SP_invertido * 2) + bonusChakra`
- Scale cap: `20`
- Display format: `current/20 (+X)` where `X` is external Chakra from plazas.

Example (Uzumaki + Kyuubi):
- D1 (0 SP Chakra): `4/20 (+4)`
- D2 (total 2 SP Chakra): `8/20 (+4)`
- D3 (total 3 SP Chakra): `10/20 (+4)`

### Non-Chakra Stats

- Display uses scale table index with:
`rankBaseIndex + investedSP + traitGradationBonus`

This means rank transitions (D -> C -> B...) can increase displayed values even if no new SP is invested, because base index can change.

---

## Nacimiento Trait Mapping (Official)

- `Fortachon`: `bonusGradations.fuerza = 1`
- `Veloz`: `bonusGradations.velocidad = 1`
- `Sabio`: `bonusChakra = 2`
- `Curtido`: `bonusGradations.resistencia = 1`
- `Agil`: `bonusGradations.percepcion = 1`
- `Preciso`: `bonusGradations.armas = 1`
- `Genio`: `bonusGradations.inteligencia = 1`
- `Equilibrado`: no gradation bonus
- `Endeble`: `bonusGradations.resistencia = -1`
- `Legendario`: no stat gradation bonus

---

## Files Updated

- `src/services/StatValidatorService.ts`
  - Added structured bonus breakdown fields for gradations and external bonuses.
  - Chakra branch now excludes plaza bonus from numerator.
  - Non-Chakra branch includes trait gradation bonus in scale index.
  - `calculateNewStats` now validates projected index using gradations and Chakra trait bonus.

- `src/commands/ficha.ts`
  - Reads `bonusGradations` from trait mechanics.
  - Routes Chakra plazas to external bonus accumulator.
  - Uses new display calculation contract.

- `prisma/seed-data/traits.json`
  - Updated Nacimiento mechanics to official mapping.

---

## Data Refresh Commands

Run after changing seed JSON:

```bash
npm run db:seed:rasgos
npm run db:seed:plazas
```

Then validate compile:

```bash
npm run build
```

---

## Verification Matrix

1. Base D1 with no Chakra modifiers -> `2/20`.
2. D1 + Sabio -> `4/20`.
3. D1 + Chakra plaza only -> `2/20 (+X)`.
4. D1 + Sabio + Kyuubi -> `4/20 (+4)`.
5. Chakra SP growth remains `+2` per SP invested.
6. Agil Percepcion progression should reflect gradation + rank-base progression.
7. Endeble should apply negative gradation to Resistencia baseline.

---

## Design Notes

- No retrocompat layer was added by design (project is still in design/demo stage).
- The canonical trait mechanics format for these rules is now:
  - `bonusGradations` for scale-index modifiers
  - `bonusChakra` for Chakra scale bonus points
