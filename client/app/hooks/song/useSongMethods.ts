"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useListSongs() {
  return useServiceMethod("songService", "listSongs");
}

export function useGetSongBeats() {
  return useServiceMethod("songService", "getSongBeats");
}
