export const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("rp_token") : null;

export const setToken = (t: string) => localStorage.setItem("rp_token", t);

export const clearToken = () => localStorage.removeItem("rp_token");

export const authHeaders = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};
