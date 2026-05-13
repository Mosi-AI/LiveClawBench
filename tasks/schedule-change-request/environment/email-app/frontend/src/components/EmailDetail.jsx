import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { emailAPI, attachmentAPI } from '../api/api'
import Navigation from './Navigation'

function EmailDetail() {
  const { id } = useParams()
  const [email, setEmail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadEmail()
  }, [id])

  const loadEmail = async () => {
    try {
      setLoading(true)
      const response = await emailAPI.getEmail(id)
      setEmail(response.data.data.email)
      setError('')

      // Mark as read if it's in inbox
      if (response.data.data.email.folder === 'inbox' && !response.data.data.email.is_read) {
        await emailAPI.markAsRead(id, true)
      }
    } catch (err) {
      setError('Failed to load email')
      console.error('Error loading email:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this email?')) {
      return
    }

    try {
      setDeleting(true)
      await emailAPI.deleteEmail(id)
      navigate('/')
    } catch (err) {
      setError('Failed to delete email')
      setDeleting(false)
      console.error('Error deleting email:', err)
    }
  }

  const handleReply = () => {
    if (email) {
      navigate('/compose', {
        state: {
          to: email.sender_email,
          subject: `Re: ${email.subject}`,
          body: `\n\n--- Original Message ---\nFrom: ${email.sender_name || email.sender_email}\nDate: ${new Date(email.created_at).toLocaleString()}\n\n${email.body}`
        }
      })
    }
  }

  const handleDownload = async (attachmentId, filename) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading attachment:', err)
      setError('Failed to download attachment')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="loading">Loading email...</div>
      </div>
    )
  }

  if (error || !email) {
    return (
      <div>
        <Navigation />
        <div className="container">
          <div className="card">
            <div className="error-message">{error || 'Email not found'}</div>
            <Link to="/" className="button button-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
              Back to Inbox
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Navigation />
      <div className="container">
        <div className="card email-detail">
          <div className="email-detail-header">
            <div className="email-detail-subject">{email.subject || '(No subject)'}</div>
            <div className="email-detail-meta">
              <div>
                <strong>From:</strong> {email.sender_name || email.sender_email}
                {email.sender_name && email.sender_email && (
                  <span> &lt;{email.sender_email}&gt;</span>
                )}
              </div>
              <div>{formatDate(email.created_at)}</div>
            </div>
            <div className="email-detail-meta" style={{ marginTop: '4px' }}>
              <div>
                <strong>To:</strong> {email.recipient_name || email.recipient_email}
                {email.recipient_name && email.recipient_email && (
                  <span> &lt;{email.recipient_email}&gt;</span>
                )}
              </div>
            </div>
          </div>

          <div className="email-detail-body">{email.body}</div>

          {email.attachments && email.attachments.length > 0 && (
            <div className="form-group">
              <label className="form-label">Attachments ({email.attachments.length})</label>
              <div style={{
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '12px'
              }}>
                {email.attachments.map((att, index) => (
                  <div key={att.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    marginBottom: index < email.attachments.length - 1 ? '8px' : '0',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '4px'
                  }}>
                    <div>
                      <span style={{ fontWeight: '500' }}>{att.original_filename}</span>
                      <small style={{ color: '#666', marginLeft: '8px' }}>
                        {formatFileSize(att.file_size)}
                      </small>
                    </div>
                    <button
                      onClick={() => handleDownload(att.id, att.original_filename)}
                      className="button button-secondary"
                      style={{ padding: '4px 12px' }}
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="email-actions">
            <button onClick={handleReply} className="button button-primary">
              Reply
            </button>
            <Link
              to="/compose"
              state={{
                to: email.sender_email,
                subject: `Fwd: ${email.subject}`,
                body: `\n\n--- Forwarded Message ---\nFrom: ${email.sender_name || email.sender_email}\nDate: ${new Date(email.created_at).toLocaleString()}\n\n${email.body}`
              }}
              className="button button-secondary"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              Forward
            </Link>
            <button
              onClick={handleDelete}
              className="button button-danger"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <Link to="/" className="button button-secondary" style={{ marginLeft: 'auto', textDecoration: 'none', display: 'inline-block' }}>
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailDetail
