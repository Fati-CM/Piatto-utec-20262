const API_URL = import.meta.env.VITE_API_URL ?? '';
export async function api<T>(path:string, init?:RequestInit):Promise<T>{
  const r = await fetch(`${API_URL}${path}`, { ...init, headers:{'Content-Type':'application/json', ...(init?.headers||{})} });
  if(!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
  return r.json();
}
