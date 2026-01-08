'use client';

import { useState, useEffect, memo } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdminNotificationPayload, MultilingualText } from '@/types/notification';

interface Course {
  id: string;
  title: string;
}

interface User {
  id: string;
  username: string | null;
  email: string;
}

function AdminNotificationSender() {
  const [targetType, setTargetType] = useState<'all' | 'role' | 'course' | 'specific'>('all');
  const [targetRole, setTargetRole] = useState<'student' | 'lecturer' | 'admin'>('student');
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [titleEn, setTitleEn] = useState('');
  const [titleGe, setTitleGe] = useState('');
  const [messageEn, setMessageEn] = useState('');
  const [messageGe, setMessageGe] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch courses for course-specific targeting
  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title');

      if (!error && data) {
        setCourses(data);
      }
    };

    fetchCourses();
  }, []);

  // Fetch users for specific user targeting
  useEffect(() => {
    const fetchUsers = async () => {
      if (targetType !== 'specific') return;

      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email')
        .order('email');

      if (!error && data) {
        setUsers(data);
        setFilteredUsers(data);
      }
      setIsLoading(false);
    };

    fetchUsers();
  }, [targetType]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u =>
        u.email.toLowerCase().includes(query) ||
        (u.username?.toLowerCase().includes(query) ?? false)
      ));
    }
  }, [searchQuery, users]);

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  const validateForm = (): string | null => {
    if (!titleEn.trim() || !titleGe.trim()) {
      return 'Title is required in both English and Georgian';
    }
    if (!messageEn.trim() || !messageGe.trim()) {
      return 'Message is required in both English and Georgian';
    }
    if (targetType === 'course' && !targetCourseId) {
      return 'Please select a course';
    }
    if (targetType === 'specific' && selectedUserIds.length === 0) {
      return 'Please select at least one user';
    }
    return null;
  };

  const handleSend = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const payload: AdminNotificationPayload = {
        target_type: targetType,
        ...(targetType === 'role' && { target_role: targetRole }),
        ...(targetType === 'course' && { target_course_id: targetCourseId }),
        ...(targetType === 'specific' && { target_user_ids: selectedUserIds }),
        title: { en: titleEn.trim(), ge: titleGe.trim() },
        message: { en: messageEn.trim(), ge: messageGe.trim() },
      };

      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notifications');
      }

      setSuccessMessage(`Successfully sent ${data.count} notification(s)!`);

      // Reset form
      setTitleEn('');
      setTitleGe('');
      setMessageEn('');
      setMessageGe('');
      setSelectedUserIds([]);
      setShowPreview(false);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send notifications');
    } finally {
      setIsSending(false);
    }
  };

  const getTargetDescription = () => {
    switch (targetType) {
      case 'all':
        return 'All users in the system';
      case 'role':
        return `All users with role: ${targetRole}`;
      case 'course':
        const course = courses.find(c => c.id === targetCourseId);
        return course ? `Users enrolled in: ${course.title}` : 'Users enrolled in selected course';
      case 'specific':
        return `${selectedUserIds.length} selected user(s)`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900">Send Notifications</h2>
        <p className="text-gray-600 mt-1">Create and send targeted notifications to users</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Target Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Target Audience
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setTargetType('all')}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                targetType === 'all'
                  ? 'border-navy-900 bg-navy-50 text-navy-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              All Users
            </button>
            <button
              type="button"
              onClick={() => setTargetType('role')}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                targetType === 'role'
                  ? 'border-navy-900 bg-navy-50 text-navy-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              By Role
            </button>
            <button
              type="button"
              onClick={() => setTargetType('course')}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                targetType === 'course'
                  ? 'border-navy-900 bg-navy-50 text-navy-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              By Course
            </button>
            <button
              type="button"
              onClick={() => setTargetType('specific')}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                targetType === 'specific'
                  ? 'border-navy-900 bg-navy-50 text-navy-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              Specific Users
            </button>
          </div>
        </div>

        {/* Role Selection */}
        {targetType === 'role' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Select Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as 'student' | 'lecturer' | 'admin')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
            >
              <option value="student">Students</option>
              <option value="lecturer">Lecturers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        )}

        {/* Course Selection */}
        {targetType === 'course' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Select Course
            </label>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
            >
              <option value="">-- Select a course --</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Selection */}
        {targetType === 'specific' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Select Users ({selectedUserIds.length} selected)
            </label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email or username..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                />
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {selectedUserIds.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                        selectedUserIds.includes(user.id)
                          ? 'bg-navy-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                      />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {user.username || user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </label>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="px-4 py-8 text-center text-gray-500">No users found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification Content */}
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Notification Content</h3>

          {/* Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (English) *
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Enter notification title in English"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (Georgian) *
              </label>
              <input
                type="text"
                value={titleGe}
                onChange={(e) => setTitleGe(e.target.value)}
                placeholder="შეიყვანეთ შეტყობინების სათაური ქართულად"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              />
            </div>
          </div>

          {/* Message */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message (English) *
              </label>
              <textarea
                value={messageEn}
                onChange={(e) => setMessageEn(e.target.value)}
                placeholder="Enter notification message in English"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message (Georgian) *
              </label>
              <textarea
                value={messageGe}
                onChange={(e) => setMessageGe(e.target.value)}
                placeholder="შეიყვანეთ შეტყობინების ტექსტი ქართულად"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Preview and Actions */}
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-navy-600 hover:text-navy-700 font-medium"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {showPreview && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-gray-900">Preview</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">English</p>
                  <p className="font-semibold text-gray-900">{titleEn || '(No title)'}</p>
                  <p className="text-sm text-gray-600 mt-1">{messageEn || '(No message)'}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Georgian</p>
                  <p className="font-semibold text-gray-900">{titleGe || '(სათაური არ არის)'}</p>
                  <p className="text-sm text-gray-600 mt-1">{messageGe || '(ტექსტი არ არის)'}</p>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Target:</span> {getTargetDescription()}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setTitleEn('');
                setTitleGe('');
                setMessageEn('');
                setMessageGe('');
                setSelectedUserIds([]);
                setError(null);
              }}
              className="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Form
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="px-6 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AdminNotificationSender);
