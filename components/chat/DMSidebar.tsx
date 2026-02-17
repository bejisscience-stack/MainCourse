'use client';

import FriendsSection from './FriendsSection';

interface DMSidebarProps {
  currentUserId: string;
  activeConversationId: string | null;
  onConversationSelect: (conversationId: string, friendUsername: string) => void;
  onAddFriend: () => void;
}

export default function DMSidebar({
  currentUserId,
  activeConversationId,
  onConversationSelect,
  onAddFriend,
}: DMSidebarProps) {
  return (
    <div className="w-full h-full bg-navy-950/70 border-r border-navy-800/60 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between shadow-soft flex-shrink-0">
        <h2 className="text-gray-100 font-semibold text-sm">Direct Messages</h2>
        <button
          onClick={onAddFriend}
          className="text-gray-400 hover:text-emerald-300 p-1.5 rounded-md hover:bg-navy-800/60 transition-colors"
          title="Add Friend"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 chat-scrollbar">
        <FriendsSection
          currentUserId={currentUserId}
          activeConversationId={activeConversationId}
          onConversationSelect={onConversationSelect}
          onAddFriend={onAddFriend}
        />
      </div>
    </div>
  );
}
