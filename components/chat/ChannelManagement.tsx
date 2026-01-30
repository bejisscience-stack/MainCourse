'use client';

import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
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
  const { t } = useI18n();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as 'text' | 'voice' | 'lectures',
    description: '',
    categoryName: 'COURSE CHANNELS',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const filteredChannels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((channel) => {
      const nameMatch = channel.name.toLowerCase().includes(query);
      const descMatch = channel.description?.toLowerCase().includes(query);
      const categoryMatch = channel.categoryName?.toLowerCase().includes(query);
      return nameMatch || descMatch || categoryMatch;
    });
  }, [channels, searchQuery]);

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
      setError(t('channels.cannotDeleteRequiredChannels'));
      return;
    }

    if (!confirm(t('channels.confirmDeleteChannel'))) {
      return;
    }

    try {
      await onChannelDelete(channelId);
    } catch (err: any) {
      setError(err.message || 'Failed to delete channel');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-navy-800/60 bg-navy-950/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t('channels.manageChannels')}</h3>
              <p className="text-xs text-gray-400">{filteredChannels.length} {filteredChannels.length === 1 ? 'channel' : 'channels'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingChannel(null);
                setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-indigo-500/25 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('channels.addChannel')}
            </button>
            <button
              onClick={onClose}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-navy-800/60 bg-navy-900/70 text-gray-300 hover:text-white hover:bg-navy-800/80 transition-colors"
              title={t('common.close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-navy-800/60 bg-navy-950/50">
        <div className="relative">
          <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.5 5.5a7.5 7.5 0 0011.15 11.15z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('channels.searchPlaceholder') || 'Search channels'}
            className="w-full pl-9 pr-3 py-2.5 bg-navy-900/70 border border-navy-800/60 text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition-all placeholder-gray-500"
          />
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 chat-scrollbar">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {filteredChannels.map((channel) => (
          <div
            key={channel.id}
            className="group relative bg-gradient-to-br from-navy-800/90 to-navy-900/70 rounded-2xl p-4 border border-navy-700/40 hover:border-navy-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-navy-900/50"
          >
            <div className="flex items-start gap-4">
              {/* Channel Icon */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg ${
                channel.type === 'lectures'
                  ? 'bg-gradient-to-br from-rose-500/30 to-orange-500/20 border border-rose-500/40 shadow-rose-500/10'
                  : channel.name.toLowerCase() === 'projects'
                  ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/20 border border-amber-500/40 shadow-amber-500/10'
                  : channel.type === 'voice'
                  ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 shadow-emerald-500/10'
                  : 'bg-gradient-to-br from-blue-500/30 to-indigo-500/20 border border-blue-500/40 shadow-blue-500/10'
              }`}>
                {channel.type === 'lectures'
                  ? '📹'
                  : channel.name.toLowerCase() === 'projects'
                  ? '📁'
                  : channel.type === 'voice'
                  ? '🔊'
                  : '#'}
              </div>

              {/* Channel Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-white font-bold text-base">{channel.name}</h4>
                  {isRequiredChannel(channel) && (
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/15 rounded-md border border-emerald-500/30">
                      {t('channels.required')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                    channel.type === 'lectures'
                      ? 'bg-rose-500/10 text-rose-400'
                      : channel.type === 'voice'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {channel.type === 'lectures' && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                    {channel.type === 'voice' && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                    {channel.type === 'text' && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    )}
                    {channel.type}
                  </span>
                </div>
                {channel.description && (
                  <p className="text-gray-500 text-xs mt-2 line-clamp-2">{channel.description}</p>
                )}
              </div>

              {/* Action Buttons */}
              {!isRequiredChannel(channel) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                  <button
                    onClick={() => handleEdit(channel)}
                    className="p-2.5 text-gray-400 hover:text-white bg-navy-700/0 hover:bg-navy-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    className="p-2.5 text-gray-400 hover:text-red-400 bg-navy-700/0 hover:bg-red-500/10 rounded-xl transition-all duration-200 hover:scale-105"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredChannels.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-navy-800/50 border border-navy-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">{searchQuery.trim() ? 'No channels match your search.' : t('channels.noChannelsYet')}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setEditingChannel(null);
              setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
            }
          }}
        >
          <div
            className="bg-gradient-to-b from-navy-800 to-navy-900 rounded-3xl shadow-2xl w-full max-w-md border border-navy-700/50 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-navy-700/50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  editingChannel ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30' : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                }`}>
                  {editingChannel ? (
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingChannel ? t('channels.editChannel') : t('channels.createChannel')}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {editingChannel ? 'Update channel settings' : 'Add a new channel to your course'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  {t('channels.channelName')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-navy-700/50 border border-navy-600/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-gray-500"
                  placeholder="general"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  {t('channels.channelType')} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                    className="w-full px-4 py-3 bg-navy-700/50 border border-navy-600/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="text">{t('channels.textChannel')}</option>
                    <option value="voice">{t('channels.voiceChannel')}</option>
                    <option value="lectures">{t('channels.lecturesChannel')}</option>
                  </select>
                  <svg className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  {t('channels.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-navy-700/50 border border-navy-600/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-gray-500 resize-none"
                  placeholder={t('channels.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  {t('channels.categoryName')}
                </label>
                <input
                  type="text"
                  value={formData.categoryName}
                  onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                  className="w-full px-4 py-3 bg-navy-700/50 border border-navy-600/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-gray-500"
                  placeholder="COURSE CHANNELS"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('channels.saving')}
                    </>
                  ) : editingChannel ? t('channels.update') : t('channels.create')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingChannel(null);
                    setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
                  }}
                  className="flex-1 bg-navy-700/80 text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-navy-600 transition-all duration-200 border border-navy-600/50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
