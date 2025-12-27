import { useState, useEffect } from 'react';
import type { Member } from '@/types/member';

export function useMembers(serverId: string | null, initialMembers: Member[] = []) {
  const [members, setMembers] = useState<Member[]>(initialMembers);

  useEffect(() => {
    if (serverId) {
      setMembers(initialMembers);
    }
  }, [serverId, initialMembers]);

  const updateMemberStatus = (memberId: string, status: Member['status']) => {
    setMembers((prev) =>
      prev.map((member) => (member.id === memberId ? { ...member, status } : member))
    );
  };

  return {
    members,
    onlineMembers: members.filter((m) => m.status === 'online'),
    offlineMembers: members.filter((m) => m.status === 'offline'),
    updateMemberStatus,
  };
}















