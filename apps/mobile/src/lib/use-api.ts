import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

export type Load<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/** Carrega um recurso da API com estados de carregando, erro e pronto, e "puxar para atualizar". */
export function useApi<T>(path: string) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  // Ignora respostas de uma consulta anterior quando o período ou o filtro mudou no meio do caminho.
  const latest = useRef(path);

  const load = useCallback(async () => {
    latest.current = path;
    try {
      const data = await api<T>(path);
      if (latest.current === path) setState({ status: "ready", data });
    } catch (error) {
      if (latest.current !== path) return;
      setState({ status: "error", message: error instanceof ApiError ? error.message : "Não foi possível carregar os dados." });
    }
  }, [path]);

  useEffect(() => {
    setState({ status: "loading" });
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  const retry = () => {
    setState({ status: "loading" });
    void load();
  };
  return { state, refreshing, refresh, retry };
}
