import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Navbar.css'; // Import the CSS file

const Navbar = () => {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let active = true;
    const loadCount = async () => {
      try { const response = await api.get('/notifications'); if (active) setUnreadCount(response.data.unreadCount || 0); }
      catch (_) { if (active) setUnreadCount(0); }
    };
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [user]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">My Library</Link>
        <div className="navbar-links">
          <Link to="/books" className="navbar-link">Books</Link>
          <Link to="/contact" className="navbar-link">Contact</Link> 
          {!user ? (
            <Link to="/login" className="navbar-link">Login</Link>
          ) : (
            <>
              <Link to="/dashboard" className="navbar-link">Dashboard</Link>
              <Link to="/notifications" className="navbar-link">Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}</Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="navbar-link">Admin Panel</Link>
              )}
              {user.role === 'librarian' && (
                <Link to="/librarian" className="navbar-link">Librarian Panel</Link>
              )}
              <button onClick={logout} className="navbar-logout">Logout</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
