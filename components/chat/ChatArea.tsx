'use client';

import { useState, useEffect, useRef } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import LecturesChannel from './LecturesChannel';
import type { Channel } from '@/types/server';
import type { Message as MessageType } from '@/types/message';
import { useMessages } from '@/hooks/useMessages';

interface ChatAreaProps {
  channel: Channel | null;
  currentUserId: string;
  isLecturer?: boolean;
  onSendMessage: (channelId: string, content: string) => void;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

export default function ChatArea({
  channel,
  currentUserId,
  isLecturer = false,
  onSendMessage,
  onReply,
  onReaction,
}: ChatAreaProps) {
  const [replyTo, setReplyTo] = useState<{
    id: string;
    username: string;
    content: string;
  } | undefined>(undefined);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { messages, addMessage, addReaction, messagesEndRef } = useMessages(
    channel?.id || null,
    channel?.messages || []
  );

  useEffect(() => {
    if (channel?.messages) {
      // Update messages when channel changes
    }
  }, [channel]);

  const handleSend = (content: string) => {
    if (!channel) return;

    const newMessage: MessageType = {
      id: `msg-${Date.now()}-${Math.random()}`,
      user: {
        id: currentUserId,
        username: 'You',
        avatarUrl: '',
      },
      content,
      timestamp: Date.now(),
      replyTo: replyTo?.id,
    };

    addMessage(newMessage);
    onSendMessage(channel.id, content);
    setReplyTo(undefined);
  };

  const handleReply = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setReplyTo({
        id: message.id,
        username: message.user.username,
        content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
      });
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    addReaction(messageId, emoji, currentUserId);
    onReaction?.(messageId, emoji);
  };

  if (!channel) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg font-medium">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  // Show Lectures channel for lectures type
  if (channel.type === 'lectures') {
    return (
      <LecturesChannel
        channel={channel}
        courseId={channel.courseId || ''}
        currentUserId={currentUserId}
        isLecturer={isLecturer}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Channel header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xl">#</span>
          <h2 className="text-white font-semibold text-sm">{channel.name}</h2>
        </div>
        {channel.description && (
          <span className="ml-4 text-gray-400 text-xs">{channel.description}</span>
        )}
        <div className="ml-auto flex items-center gap-4">
          <button className="text-gray-400 hover:text-white transition-colors" title="Threads">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Notifications">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Pinned Messages">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Members">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-700"></div>
          <input
            type="text"
            placeholder="Search"
            className="bg-gray-800 text-gray-300 text-sm px-3 py-1.5 rounded w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const showAvatar =
                index === 0 || messages[index - 1].user.id !== message.user.id;
              return (
                <div key={message.id}>
                  <Message
                    message={message}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onReaction={handleReaction}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        placeholder={`Message #${channel.name}`}
      />
    </div>
  );
}
