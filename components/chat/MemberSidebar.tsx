'use client';

import type { Member } from '@/types/member';

interface MemberSidebarProps {
  members: Member[];
  onlineMembers: Member[];
  offlineMembers: Member[];
  onCollapse?: () => void;
}

export default function MemberSidebar({
  members,
  onlineMembers,
  offlineMembers,
  onCollapse,
}: MemberSidebarProps) {
  // Component is now empty - search bar and members list have been removed
  return (
    <div className="w-full h-full bg-navy-900 flex flex-col overflow-hidden">
      {/* Empty sidebar */}
    </div>
  );
}



