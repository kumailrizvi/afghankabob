export function qrUrl(value: string, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

export function memberId() {
  return `AKR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
