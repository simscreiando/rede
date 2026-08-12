import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ProfileSummary = { id: string; display_name: string; avatar_url: string | null };

export function useProfileNames(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id))).sort();

  const query = useQuery({
    queryKey: ["profile-names", unique.join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", unique);
      if (error) throw error;
      const map: Record<string, ProfileSummary> = {};
      for (const row of data ?? []) map[row.id] = row as ProfileSummary;
      return map;
    },
  });

  const map = query.data ?? {};
  return {
    map,
    nameOf: (id: string | null | undefined) =>
      (id ? map[id]?.display_name : undefined) ?? "Pessoa da Rede",
  };
}
