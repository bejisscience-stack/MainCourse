export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  role?: string;
  roleColor?: string;
}

export interface Member extends User {
  status: 'online' | 'offline' | 'away' | 'busy';
}










