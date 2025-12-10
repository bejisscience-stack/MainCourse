'use client';

import { useState } from 'react';
import type { Channel } from '@/types/server';

interface ChannelManagementProps {
  courseId: string;
  channels: Channel[];
  onChannelCreate: (channel: Omit<Channel, 'id'>) => Promise<void>;
  onChannelUpdate: (channelId: string, updates: Partial<Channel>) => Promise<void>;
  onChannelDelete: (channelId: string) => Promise<void>;
  onClose: () => void;
}

export default function ChannelManagement({
  courseId,
  channels,
  onChannelCreate,
  onChannelUpdate,
  onChannelDelete,
  onClose,
}: ChannelManagementProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as 'text' | 'voice' | 'lectures',
    description: '',
    categoryName: 'COURSE CHANNELS',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (editingChannel) {
        await onChannelUpdate(editingChannel.id, formData);
      } else {
        await onChannelCreate({
          ...formData,
          courseId,
          displayOrder: channels.length,
        });
      }
      setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
      setShowCreateModal(false);
      setEditingChannel(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save channel');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      type: channel.type,
      description: channel.description || '',
      categoryName: channel.categoryName || 'COURSE CHANNELS',
    });
    setShowCreateModal(true);
  };

  // Check if a channel is required (cannot be deleted)
  const isRequiredChannel = (channel: Channel): boolean => {
    return (
      (channel.type === 'lectures' && channel.name.toLowerCase() === 'lectures') ||
      (channel.name.toLowerCase() === 'projects')
    );
  };

  const handleDelete = async (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;

    // Prevent deletion of required channels
    if (isRequiredChannel(channel)) {
      setError('Cannot delete required channels (Lectures and Projects)');
      return;
    }

    if (!confirm('Are you sure you want to delete this channel? This action cannot be undone.')) {
      return;
    }

    try {
      await onChannelDelete(channelId);
    } catch (err: any) {
      setError(err.message || 'Failed to delete channel');
    }
  };

  return (
    <>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">Manage Channels</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingChannel(null);
              setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
              setShowCreateModal(true);
            }}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
          >
            + Add Channel
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {channels.map((channel) => (
          <div
            key={channel.id}
            className="bg-gray-700/50 rounded p-3 flex items-center justify-between group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {channel.type === 'lectures' 
                    ? '📹' 
                    : channel.name.toLowerCase() === 'projects' 
                    ? '📁' 
                    : channel.type === 'voice' 
                    ? '🔊' 
                    : '#'}
                </span>
                <span className="text-white font-medium">{channel.name}</span>
                <span className="text-gray-400 text-xs">({channel.type})</span>
              </div>
              {channel.description && (
                <p className="text-gray-400 text-xs mt-1 truncate">{channel.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isRequiredChannel(channel) && (
                <span className="text-xs text-indigo-400 font-medium">Required</span>
              )}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isRequiredChannel(channel) && (
                  <button
                    onClick={() => handleEdit(channel)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                )}
                {!isRequiredChannel(channel) && (
                  <button
                    onClick={() => handleDelete(channel.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {channels.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>No channels yet. Create your first channel!</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold">
                {editingChannel ? 'Edit Channel' : 'Create Channel'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Channel Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="general"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Channel Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="text">Text Channel</option>
                  <option value="voice">Voice Channel</option>
                  <option value="lectures">Lectures Channel</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="What is this channel for?"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={formData.categoryName}
                  onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="COURSE CHANNELS"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white font-semibold px-4 py-2 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingChannel ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingChannel(null);
                    setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
                  }}
                  className="flex-1 bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
