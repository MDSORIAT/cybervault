import axios from 'axios';

export const API_KEY = import.meta.env.VITE_API_KEY || 'dev-cybervault-key';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.zip', '.txt', '.png', '.jpg', '.jpeg', '.dwg', '.dxf', '.html', '.css', '.js'];

export const api = axios.create({ baseURL: '/api', headers: { 'x-api-key': API_KEY } });

export function openStream(onSnapshot) {
  const source = new EventSource(`/api/stream?key=${encodeURIComponent(API_KEY)}`);
  source.onmessage = (e) => onSnapshot(JSON.parse(e.data));
  return source;
}

export async function downloadFile(file) {
  const { data } = await api.get(`/files/${file.id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.originalName });
  a.click();
  URL.revokeObjectURL(url);
}

export function errorCode(err) {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.response?.status === 429) return 'RATE_LIMIT_EXCEEDED';
  return err.response ? `HTTP_${err.response.status}` : 'NETWORK_UNREACHABLE';
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}
