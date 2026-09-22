import { useCallback } from "react";
import { useAuth } from "@clerk/react";
import type { AxiosResponse } from "axios";

export function useApi() {
  const { getToken } = useAuth();

  const authRequest = useCallback(
    async <T>(
      requestFn: (token: string) => Promise<AxiosResponse<T>>,
    ): Promise<AxiosResponse<T>> => {
      const token = await getToken();
      if (!token) {
        throw new Error("You must be signed in to do that.");
      }
      return requestFn(token);
    },
    [getToken],
  );

  return { authRequest };
}
