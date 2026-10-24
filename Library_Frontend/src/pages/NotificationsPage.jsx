import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load notifications. Please sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, isRead: true } : item));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update notification.');
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update notifications.');
    }
  };

  return (
    <main className="notifications-page">
      <div className="notifications-heading">
        <div><h1>Notifications</h1><p>Updates about your library activity.</p></div>
        <button type="button" onClick={markAllRead} disabled={!notifications.some((item) => !item.isRead)}>Mark all as read</button>
      </div>
      {error && <p className="notification-error">{error}</p>}
      {loading ? <p>Loading notifications...</p> : notifications.length === 0 ? (
        <div className="notifications-empty"><h2>You're all caught up</h2><p>New borrowing and due-date updates will appear here.</p></div>
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => (
            <article key={item._id} className={`notification-item ${item.isRead ? 'is-read' : 'is-unread'}`}>
              <div className="notification-copy"><h2>{item.title}</h2><p>{item.message}</p><time>{new Date(item.createdAt).toLocaleString()}</time></div>
              {!item.isRead && <button type="button" onClick={() => markRead(item._id)}>Mark read</button>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
};

export default NotificationsPage;
