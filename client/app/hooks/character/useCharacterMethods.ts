"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateCharacter() {
  return useServiceMethod("characterService", "createCharacter");
}

export function useUpdateCharacter() {
  return useServiceMethod("characterService", "updateCharacter");
}

export function useListMyCharacters() {
  return useServiceMethod("characterService", "listMine");
}
