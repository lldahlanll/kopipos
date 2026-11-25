// Halaman awal tiap peran (dipakai login, route index, dan guard akses)
export function homePathForRole(role) {
  if (role === 'owner') return '/dashboard';
  if (role === 'kitchen') return '/kitchen';
  if (role === 'promo') return '/promos';
  return '/pos';
}
