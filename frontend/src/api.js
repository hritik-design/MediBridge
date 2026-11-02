import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('mb_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
    localStorage.removeItem('mb_token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export const errMsg = e => e.response?.data?.errors?.map(x => x.message).join(', ') || e.response?.data?.message || 'Something went wrong';
export default api;

export async function download(path, filename, params) {
  const r = await api.get(path, { responseType: 'blob', params });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
