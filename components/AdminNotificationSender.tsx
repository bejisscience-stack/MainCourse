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

interface ComingSoonEmail {
  id: string;
  email: string;
}

function AdminNotificationSender() {
  const [channel, setChannel] = useState<'in_app' | 'email' | 'both'>('in_app');
  const [language, setLanguage] = useState<'en' | 'ge' | 'both'>('both');
  const [targetType, setTargetType] = useState<'all' | 'role' | 'course' | 'specific'>('all');
  const [targetRole, setTargetRole] = useState<'student' | 'lecturer' | 'admin'>('student');
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Email-specific state
  const [emailTarget, setEmailTarget] = useState<'profiles' | 'coming_soon' | 'both' | 'specific'>('profiles');
  const [comingSoonEmails, setComingSoonEmails] = useState<ComingSoonEmail[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [manualEmails, setManualEmails] = useState('');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');

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
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);
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

  // Fetch coming_soon_emails when needed
  useEffect(() => {
    const fetchComingSoonEmails = async () => {
      if (channel === 'in_app') return;
      if (emailTarget !== 'coming_soon' && emailTarget !== 'specific') return;

      const { data, error } = await supabase
        .from('coming_soon_emails')
        .select('id, email')
        .order('email');

      if (!error && data) {
        setComingSoonEmails(data);
      }
    };

    fetchComingSoonEmails();
  }, [channel, emailTarget]);

  // Also fetch users list when email target is 'specific' (for combined selection)
  useEffect(() => {
    const fetchUsersForEmail = async () => {
      if (channel === 'in_app') return;
      if (emailTarget !== 'specific') return;
      if (users.length > 0) return; // Already loaded

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email')
        .order('email');

      if (!error && data) {
        setUsers(data);
        setFilteredUsers(data);
      }
    };

    fetchUsersForEmail();
  }, [channel, emailTarget, users.length]);

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

  const handleEmailToggle = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const filteredComingSoonEmails = emailSearchQuery.trim()
    ? comingSoonEmails.filter(e => e.email.toLowerCase().includes(emailSearchQuery.toLowerCase()))
    : comingSoonEmails;

  const showInAppTargeting = channel === 'in_app' || channel === 'both';
  const showEmailTargeting = channel === 'email' || channel === 'both';

  const validateForm = (): string | null => {
    if ((language === 'en' || language === 'both') && !titleEn.trim()) {
      return 'English title is required';
    }
    if ((language === 'ge' || language === 'both') && !titleGe.trim()) {
      return 'Georgian title is required';
    }
    if ((language === 'en' || language === 'both') && !messageEn.trim()) {
      return 'English message is required';
    }
    if ((language === 'ge' || language === 'both') && !messageGe.trim()) {
      return 'Georgian message is required';
    }
    if (showInAppTargeting) {
      if (targetType === 'course' && !targetCourseId) {
        return 'Please select a course';
      }
      if (targetType === 'specific' && selectedUserIds.length === 0) {
        return 'Please select at least one user';
      }
    }
    if (showEmailTargeting) {
      if (emailTarget === 'specific') {
        const manualList = manualEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
        if (manualList.length === 0 && selectedEmails.length === 0) {
          return 'Please enter or select at least one email address';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of manualList) {
          if (!emailRegex.test(email)) {
            return `Invalid email address: ${email}`;
          }
        }
      }
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
    setIsPartialSuccess(false);
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Build target_emails for specific email targeting
      let resolvedTargetEmails: string[] | undefined;
      if (showEmailTargeting && emailTarget === 'specific') {
        const manualList = manualEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
        const combined = new Set([...manualList, ...selectedEmails]);
        resolvedTargetEmails = Array.from(combined);
      }

      const payload: AdminNotificationPayload = {
        target_type: targetType,
        ...(targetType === 'role' && { target_role: targetRole }),
        ...(targetType === 'course' && { target_course_id: targetCourseId }),
        ...(targetType === 'specific' && { target_user_ids: selectedUserIds }),
        title: {
          en: language === 'ge' ? '' : titleEn.trim(),
          ge: language === 'en' ? '' : titleGe.trim(),
        },
        message: {
          en: language === 'ge' ? '' : messageEn.trim(),
          ge: language === 'en' ? '' : messageGe.trim(),
        },
        language,
        channel,
        ...(showEmailTargeting && { email_target: emailTarget }),
        ...(resolvedTargetEmails && { target_emails: resolvedTargetEmails }),
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

      const parts: string[] = [];
      if (data.in_app_count > 0) parts.push(`${data.in_app_count} in-app notification(s)`);
      if (data.email_count > 0) parts.push(`${data.email_count} email(s)`);
      if (data.email_failed_count > 0) parts.push(`${data.email_failed_count} email(s) failed`);

      if (data.email_failed_count > 0 && data.email_count === 0 && data.in_app_count === 0) {
        throw new Error(`All emails failed to send. Error: ${data.email_error || 'Unknown error'}`);
      }

      if (data.email_failed_count > 0) {
        setIsPartialSuccess(true);
        setSuccessMessage(`Partially sent: ${parts.join(', ')}. Error: ${data.email_error || 'Unknown'}`);
      } else {
        setIsPartialSuccess(false);
        setSuccessMessage(`Successfully sent: ${parts.join(', ') || 'No notifications sent'}`);
      }

      // Reset form
      setTitleEn('');
      setTitleGe('');
      setMessageEn('');
      setMessageGe('');
      setSelectedUserIds([]);
      setSelectedEmails([]);
      setManualEmails('');
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

  const getEmailTargetDescription = () => {
    switch (emailTarget) {
      case 'profiles':
        return `Profile emails (${getTargetDescription()})`;
      case 'coming_soon':
        return 'All pre-launch subscribers';
      case 'both':
        return `Profile emails + pre-launch subscribers (deduplicated)`;
      case 'specific':
        const manualCount = manualEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean).length;
        const total = manualCount + selectedEmails.length;
        return `${total} manually specified email(s)`;
      default:
        return '';
    }
  };

  const channelButtonClass = (value: string) =>
    `px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
      channel === value
        ? 'border-navy-900 bg-navy-50 text-navy-900'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
    }`;

  const targetButtonClass = (value: string) =>
    `px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
      targetType === value
        ? 'border-navy-900 bg-navy-50 text-navy-900'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
    }`;

  const emailTargetButtonClass = (value: string) =>
    `px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
      emailTarget === value
        ? 'border-navy-900 bg-navy-50 text-navy-900'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
    }`;

  const languageButtonClass = (value: string) =>
    `px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
      language === value
        ? 'border-navy-900 bg-navy-50 text-navy-900'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
    }`;

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
        <div className={`px-4 py-3 rounded-lg ${isPartialSuccess ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Channel Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Notification Channel
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setChannel('in_app')}
              className={channelButtonClass('in_app')}
            >
              In-App Only
            </button>
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={channelButtonClass('email')}
            >
              Email Only
            </button>
            <button
              type="button"
              onClick={() => setChannel('both')}
              className={channelButtonClass('both')}
            >
              Both
            </button>
          </div>
        </div>

        {/* Language Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Language
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={languageButtonClass('en')}
            >
              English Only
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ge')}
              className={languageButtonClass('ge')}
            >
              Georgian Only
            </button>
            <button
              type="button"
              onClick={() => setLanguage('both')}
              className={languageButtonClass('both')}
            >
              Both
            </button>
          </div>
        </div>

        {/* In-App Target Selection */}
        {showInAppTargeting && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {channel === 'both' ? 'In-App Target Audience' : 'Target Audience'}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={targetButtonClass('all')}
              >
                All Users
              </button>
              <button
                type="button"
                onClick={() => setTargetType('role')}
                className={targetButtonClass('role')}
              >
                By Role
              </button>
              <button
                type="button"
                onClick={() => setTargetType('course')}
                className={targetButtonClass('course')}
              >
                By Course
              </button>
              <button
                type="button"
                onClick={() => setTargetType('specific')}
                className={targetButtonClass('specific')}
              >
                Specific Users
              </button>
            </div>
          </div>
        )}

        {/* Role Selection */}
        {showInAppTargeting && targetType === 'role' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Select Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as 'student' | 'lecturer' | 'admin')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
            >
              <option value="student">Students</option>
              <option value="lecturer">Lecturers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        )}

        {/* Course Selection */}
        {showInAppTargeting && targetType === 'course' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Select Course
            </label>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
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

        {/* User Selection (for in-app specific) */}
        {showInAppTargeting && targetType === 'specific' && (
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
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

        {/* Email Target Selection */}
        {showEmailTargeting && (
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Email Recipients
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setEmailTarget('profiles')}
                className={emailTargetButtonClass('profiles')}
              >
                Profiles
              </button>
              <button
                type="button"
                onClick={() => setEmailTarget('coming_soon')}
                className={emailTargetButtonClass('coming_soon')}
              >
                Coming Soon
              </button>
              <button
                type="button"
                onClick={() => setEmailTarget('both')}
                className={emailTargetButtonClass('both')}
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => setEmailTarget('specific')}
                className={emailTargetButtonClass('specific')}
              >
                Specific Persons
              </button>
            </div>

            {/* Profiles sub-options: show the same target type selector */}
            {emailTarget === 'profiles' && channel === 'email' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Which profile users?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={targetButtonClass('all')}
                  >
                    All Users
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('role')}
                    className={targetButtonClass('role')}
                  >
                    By Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('course')}
                    className={targetButtonClass('course')}
                  >
                    By Course
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('specific')}
                    className={targetButtonClass('specific')}
                  >
                    Specific Users
                  </button>
                </div>

                {/* Role Selection for email-only profiles */}
                {targetType === 'role' && (
                  <div className="mt-3">
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as 'student' | 'lecturer' | 'admin')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                    >
                      <option value="student">Students</option>
                      <option value="lecturer">Lecturers</option>
                      <option value="admin">Admins</option>
                    </select>
                  </div>
                )}

                {/* Course Selection for email-only profiles */}
                {targetType === 'course' && (
                  <div className="mt-3">
                    <select
                      value={targetCourseId}
                      onChange={(e) => setTargetCourseId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
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

                {/* Specific Users for email-only profiles */}
                {targetType === 'specific' && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by email or username..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {filteredUsers.map(user => (
                        <label
                          key={user.id}
                          className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                            selectedUserIds.includes(user.id) ? 'bg-navy-50' : 'hover:bg-gray-50'
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
                        <p className="px-4 py-6 text-center text-gray-500">No users found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Both info */}
            {emailTarget === 'both' && channel === 'email' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Which profile users?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={targetButtonClass('all')}
                  >
                    All Users
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('role')}
                    className={targetButtonClass('role')}
                  >
                    By Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('course')}
                    className={targetButtonClass('course')}
                  >
                    By Course
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('specific')}
                    className={targetButtonClass('specific')}
                  >
                    Specific Users
                  </button>
                </div>

                {targetType === 'role' && (
                  <div className="mt-3">
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as 'student' | 'lecturer' | 'admin')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                    >
                      <option value="student">Students</option>
                      <option value="lecturer">Lecturers</option>
                      <option value="admin">Admins</option>
                    </select>
                  </div>
                )}

                {targetType === 'course' && (
                  <div className="mt-3">
                    <select
                      value={targetCourseId}
                      onChange={(e) => setTargetCourseId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
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

                <p className="mt-3 text-sm text-gray-500">
                  Emails will be sent to both the selected profile users and all pre-launch subscribers. Duplicates will be automatically removed.
                </p>
              </div>
            )}

            {/* Coming Soon email list */}
            {emailTarget === 'coming_soon' && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  Email will be sent to all {comingSoonEmails.length} pre-launch subscriber(s).
                </p>
              </div>
            )}

            {/* Specific Persons - manual input + selection */}
            {emailTarget === 'specific' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manual Email Entry
                  </label>
                  <textarea
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    placeholder="Enter email addresses, separated by commas or new lines..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900 resize-none"
                  />
                </div>

                {/* Selectable lists from profiles + coming_soon */}
                {(users.length > 0 || comingSoonEmails.length > 0) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Or select from existing emails ({selectedEmails.length} selected)
                    </label>
                    <input
                      type="text"
                      value={emailSearchQuery}
                      onChange={(e) => setEmailSearchQuery(e.target.value)}
                      placeholder="Search emails..."
                      className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {/* Profile emails */}
                      {users
                        .filter(u => !emailSearchQuery.trim() || u.email.toLowerCase().includes(emailSearchQuery.toLowerCase()))
                        .map(user => (
                          <label
                            key={`profile-${user.id}`}
                            className={`flex items-center px-4 py-2 cursor-pointer transition-colors ${
                              selectedEmails.includes(user.email) ? 'bg-navy-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedEmails.includes(user.email)}
                              onChange={() => handleEmailToggle(user.email)}
                              className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                            />
                            <div className="ml-3 flex items-center gap-2">
                              <p className="text-sm text-gray-900">{user.email}</p>
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">profile</span>
                            </div>
                          </label>
                        ))}
                      {/* Coming soon emails */}
                      {filteredComingSoonEmails.map(cs => (
                        <label
                          key={`cs-${cs.id}`}
                          className={`flex items-center px-4 py-2 cursor-pointer transition-colors ${
                            selectedEmails.includes(cs.email) ? 'bg-navy-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmails.includes(cs.email)}
                            onChange={() => handleEmailToggle(cs.email)}
                            className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                          />
                          <div className="ml-3 flex items-center gap-2">
                            <p className="text-sm text-gray-900">{cs.email}</p>
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">subscriber</span>
                          </div>
                        </label>
                      ))}
                      {users.length === 0 && comingSoonEmails.length === 0 && (
                        <p className="px-4 py-6 text-center text-gray-500">No emails found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notification Content */}
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Notification Content</h3>

          {/* Title */}
          <div className={`grid gap-4 ${language === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {(language === 'en' || language === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title (English) *
                </label>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Enter notification title in English"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                />
              </div>
            )}
            {(language === 'ge' || language === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title (Georgian) *
                </label>
                <input
                  type="text"
                  value={titleGe}
                  onChange={(e) => setTitleGe(e.target.value)}
                  placeholder="შეიყვანეთ შეტყობინების სათაური ქართულად"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                />
              </div>
            )}
          </div>

          {/* Message */}
          <div className={`grid gap-4 ${language === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {(language === 'en' || language === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (English) *
                </label>
                <textarea
                  value={messageEn}
                  onChange={(e) => setMessageEn(e.target.value)}
                  placeholder="Enter notification message in English"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900 resize-none"
                />
              </div>
            )}
            {(language === 'ge' || language === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (Georgian) *
                </label>
                <textarea
                  value={messageGe}
                  onChange={(e) => setMessageGe(e.target.value)}
                  placeholder="შეიყვანეთ შეტყობინების ტექსტი ქართულად"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900 resize-none"
                />
              </div>
            )}
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
              <div className={`grid gap-4 ${language === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {(language === 'en' || language === 'both') && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">English</p>
                    <p className="font-semibold text-gray-900">{titleEn || '(No title)'}</p>
                    <p className="text-sm text-gray-600 mt-1">{messageEn || '(No message)'}</p>
                  </div>
                )}
                {(language === 'ge' || language === 'both') && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Georgian</p>
                    <p className="font-semibold text-gray-900">{titleGe || '(სათაური არ არის)'}</p>
                    <p className="text-sm text-gray-600 mt-1">{messageGe || '(ტექსტი არ არის)'}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Channel:</span>{' '}
                    {channel === 'in_app' ? 'In-App Only' : channel === 'email' ? 'Email Only' : 'Both (In-App + Email)'}
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    <span className="font-medium">Language:</span>{' '}
                    {language === 'en' ? 'English Only' : language === 'ge' ? 'Georgian Only' : 'Both (EN + GE)'}
                  </p>
                </div>
                {showInAppTargeting && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">In-App Target:</span> {getTargetDescription()}
                    </p>
                  </div>
                )}
                {showEmailTargeting && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm text-purple-800">
                      <span className="font-medium">Email Target:</span> {getEmailTargetDescription()}
                    </p>
                  </div>
                )}
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
                setSelectedEmails([]);
                setManualEmails('');
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
