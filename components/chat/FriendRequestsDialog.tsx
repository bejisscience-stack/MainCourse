"use client";

import { useState } from "react";
import type { FriendRequest } from "@/types/dm";

interface FriendRequestsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  onAccept: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function FriendRequestsDialog({
  isOpen,
  onClose,
  incoming,
  outgoing,
  onAccept,
  onReject,
  isLoading = false,
}: FriendRequestsDialogProps) {
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onAccept(requestId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onReject(requestId);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  const requests = activeTab === "incoming" ? incoming : outgoing;

  return (
    <div
      className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-navy-950/95 border border-navy-800/60 rounded-2xl shadow-soft-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-800/60 flex items-center justify-between">
          <h2 className="text-gray-100 font-semibold text-lg">
            Friend Requests
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-navy-800/60 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-navy-800/60">
          <button
            onClick={() => setActiveTab("incoming")}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "incoming"
                ? "text-emerald-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Incoming{" "}
            {incoming.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {incoming.length}
              </span>
            )}
            {activeTab === "incoming" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("outgoing")}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "outgoing"
                ? "text-emerald-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Outgoing{" "}
            {outgoing.length > 0 && (
              <span className="ml-1.5 bg-gray-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {outgoing.length}
              </span>
            )}
            {activeTab === "outgoing" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Request list */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto chat-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {activeTab === "incoming"
                ? "No pending requests"
                : "No outgoing requests"}
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => {
                const isProcessing = processingId === request.id;

                return (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-navy-900/30 border border-navy-800/40"
                  >
                    <div className="w-9 h-9 rounded-full bg-navy-900/70 border border-navy-800/60 flex items-center justify-center text-xs font-semibold text-emerald-200 overflow-hidden flex-shrink-0">
                      {request.user.avatarUrl ? (
                        <img
                          src={request.user.avatarUrl}
                          alt={request.user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        request.user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-200 text-sm font-medium truncate">
                        {request.user.username}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {activeTab === "incoming" ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAccept(request.id)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500/80 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? "..." : "Accept"}
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 bg-navy-800/60 hover:bg-navy-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 px-2">
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
