import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { emailAPI } from '../api/api'
import Navigation from './Navigation'

function Dashboard() {
  const [emails, setEmails] = useState([])
  const [folder, setFolder] = useState('inbox')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadEmails()
  }, [folder])

  const loadEmails = async () => {
    try {
      setLoading(true)
      const response = await emailAPI.getEmails(folder)
      setEmails(response.data.data.emails)
      setError('')
    } catch (err) {
      setError('Failed to load emails')
      console.error('Error loading emails:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (emailId, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this email?')) {
      return
    }

    try {
      await emailAPI.deleteEmail(emailId)
      loadEmails()
    } catch (err) {
      setError('Failed to delete email')
      console.error('Error deleting email:', err)
    }
  }

  const handleMarkAsRead = async (emailId, e) => {
    e.stopPropagation()
    try {
      await emailAPI.markAsRead(emailId, true)
      loadEmails()
    } catch (err) {
      console.error('Error marking email as read:', err)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getFolderName = (folder) => {
    const names = {
      inbox: 'Inbox',
      sent: 'Sent',
      drafts: 'Drafts',
      trash: 'Trash'
    }
    return names[folder] || folder
  }

  return (
    <div>
      <Navigation />
      <div className="container">
        <div className="folder-nav">
          <button
            className={`folder-button ${folder === 'inbox' ? 'active' : ''}`}
            onClick={() => setFolder('inbox')}
          >
            Inbox
          </button>
          <button
            className={`folder-button ${folder === 'sent' ? 'active' : ''}`}
            onClick={() => setFolder('sent')}
          >
            Sent
          </button>
          <button
            className={`folder-button ${folder === 'drafts' ? 'active' : ''}`}
            onClick={() => setFolder('drafts')}
          >
            Drafts
          </button>
          <button
            className={`folder-button ${folder === 'trash' ? 'active' : ''}`}
            onClick={() => setFolder('trash')}
          >
            Trash
          </button>
          <Link to="/compose" className="folder-button button-primary" style={{ marginLeft: 'auto' }}>
            Compose
          </Link>
        </div>

        <h1>{getFolderName(folder)}</h1>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Loading emails...</div>
        ) : emails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">No emails in {getFolderName(folder).toLowerCase()}</div>
          </div>
        ) : (
          <div className="email-list">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`email-item ${!email.is_read && folder === 'inbox' ? 'email-item-unread' : ''}`}
                onClick={() => navigate(`/emails/${email.id}`)}
              >
                <div className="email-header">
                  <div className="email-from">
                    {folder === 'sent' || folder === 'drafts'
                      ? `To: ${email.recipient_name || email.recipient_email}`
                      : `${email.sender_name || email.sender_email}`}
                  </div>
                  <div className="email-date">{formatDate(email.created_at)}</div>
                </div>
                <div className="email-subject">
                  {email.subject || '(No subject)'}
                </div>
                <div className="email-preview">
                  {email.body.substring(0, 100)}...
                </div>
                <div style={{ marginTop: '8px' }}>
                  {!email.is_read && folder === 'inbox' && (
                    <button
                      className="button button-secondary"
                      style={{ fontSize: '12px', padding: '4px 8px', marginRight: '8px' }}
                      onClick={(e) => handleMarkAsRead(email.id, e)}
                    >
                      Mark as Read
                    </button>
                  )}
                  {folder === 'drafts' && (
                    <Link
                      to={`/compose/${email.id}`}
                      className="button button-primary"
                      style={{ fontSize: '12px', padding: '4px 8px', marginRight: '8px', display: 'inline-block' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                  )}
                  <button
                    className="button button-danger"
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                    onClick={(e) => handleDelete(email.id, e)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
