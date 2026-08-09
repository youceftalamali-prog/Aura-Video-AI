import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput } from '@aura/types';
import { api, setTokens, clearTokens, getAccessToken } from '../lib/api';

export function useAuth() {
  const queryClient = useQueryClient();
  const isAuthenticated = !!getAccessToken();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
    enabled: isAuthenticated,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => api.login(input),
    onSuccess: (data) => {
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      queryClient.setQueryData(['me'], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => api.register(input),
    onSuccess: (data) => {
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      queryClient.setQueryData(['me'], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      clearTokens();
      queryClient.clear();
    },
  });

  return {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}
