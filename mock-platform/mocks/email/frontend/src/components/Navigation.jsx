import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navigation() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="nav">
      <div className="container nav-content">
        <div className="nav-brand">
          <Link to="/" className="nav-link">MOSI Inc. Email System</Link>
        </div>
        <div className="nav-links">
          <span>Welcome, {user?.username}</span>
          <button onClick={handleLogout} className="button button-secondary" style={{ padding: '6px 12px' }}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
