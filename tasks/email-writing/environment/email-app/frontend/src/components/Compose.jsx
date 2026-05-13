import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { emailAPI, attachmentAPI } from '../api/api'
import Navigation from './Navigation'

function Compose() {
  const { draftId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDraft, setIsDraft] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    // Check if we're editing a draft
    if (draftId) {
      loadDraft()
    }

    // Check if we have pre-filled data from navigation state (reply/forward)
    if (location.state) {
      if (location.state.to) setTo(location.state.to)
      if (location.state.subject) setSubject(location.state.subject)
      if (location.state.body) setBody(location.state.body)
    }
  }, [draftId, location.state])

  const loadDraft = async () => {
    try {
      setLoading(true)
      const response = await emailAPI.getEmail(draftId)
      const draft = response.data.data.email

      if (draft.folder === 'drafts') {
        setTo(draft.recipient_email || '')
        setSubject(draft.subject || '')
        setBody(draft.body || '')
        setAttachments(draft.attachments || [])
        setIsDraft(true)
      } else {
        setError('This is not a draft')
      }
    } catch (err) {
      setError('Failed to load draft')
      console.error('Error loading draft:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Check total size
    const currentSize = attachments.reduce((sum, att) => sum + att.file_size, 0)
    const newSize = files.reduce((sum, file) => sum + file.size, 0)
    if (currentSize + newSize > 10 * 1024 * 1024) {
      setError('Total attachment size exceeds 10MB limit')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const response = await attachmentAPI.uploadFiles(files, (progress) => {
        setUploadProgress(progress)
      })

      const newAttachments = response.data.data.attachments.map(att => ({
        ...att,
        progress: 100,
        error: null
      }))

      setAttachments([...attachments, ...newAttachments])
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload attachments')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleRemoveAttachment = async (attachmentId) => {
    try {
      // If attachment has an ID, delete from server
      if (attachmentId) {
        await attachmentAPI.deleteAttachment(attachmentId)
      }
      setAttachments(attachments.filter(att => att.id !== attachmentId))
    } catch (err) {
      console.error('Error removing attachment:', err)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleSend = async () => {
    if (!to || !subject || !body) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      const attachmentIds = attachments.map(att => att.id)

      if (isDraft) {
        // Update existing draft and send it
        await emailAPI.updateEmail(draftId, {
          recipient: to,
          subject,
          body,
          attachment_ids: attachmentIds
        })
        await emailAPI.sendDraft(draftId)
      } else {
        // Create and send new email
        await emailAPI.createEmail({
          recipient: to,
          subject,
          body,
          send_now: true,
          attachment_ids: attachmentIds
        })
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send email')
      setLoading(false)
      console.error('Error sending email:', err)
    }
  }

  const handleSaveDraft = async () => {
    if (!to || !subject || !body) {
      setError('Please fill in all fields to save as draft')
      return
    }

    setLoading(true)
    setError('')

    try {
      const attachmentIds = attachments.map(att => att.id)

      if (isDraft) {
        // Update existing draft
        await emailAPI.updateEmail(draftId, {
          recipient: to,
          subject,
          body,
          attachment_ids: attachmentIds
        })
      } else {
        // Create new draft
        await emailAPI.createEmail({
          recipient: to,
          subject,
          body,
          send_now: false,
          attachment_ids: attachmentIds
        })
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save draft')
      setLoading(false)
      console.error('Error saving draft:', err)
    }
  }

  const handleCancel = () => {
    if (to || subject || body) {
      if (window.confirm('Are you sure you want to cancel? Your changes will be lost.')) {
        navigate('/')
      }
    } else {
      navigate('/')
    }
  }

  if (loading && isDraft) {
    return (
      <div>
        <Navigation />
        <div className="loading">Loading draft...</div>
      </div>
    )
  }

  return (
    <div>
      <Navigation />
      <div className="container">
        <div className="card" style={{ maxWidth: '800px' }}>
          <h1 style={{ marginBottom: '24px' }}>
            {isDraft ? 'Edit Draft' : 'Compose Email'}
          </h1>

          {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

          <div className="form">
            <div className="form-group">
              <label className="form-label">To</label>
              <input
                type="email"
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subject</label>
              <input
                type="text"
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attachments (Max 10MB total)</label>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  disabled={loading || uploading}
                  style={{ marginBottom: '8px' }}
                />
                {uploading && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      width: '100%',
                      height: '20px',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${uploadProgress}%`,
                        height: '100%',
                        backgroundColor: '#007bff',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    <small style={{ color: '#666' }}>Uploading... {uploadProgress}%</small>
                  </div>
                )}
              </div>

              {attachments.length > 0 && (
                <div style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '12px',
                  marginTop: '8px'
                }}>
                  {attachments.map((att, index) => (
                    <div key={att.id || index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px',
                      marginBottom: index < attachments.length - 1 ? '8px' : '0',
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
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '0 8px'
                        }}
                        disabled={loading || uploading}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                    Total: {formatFileSize(attachments.reduce((sum, att) => sum + att.file_size, 0))} / 10 MB
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                className="input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here..."
                disabled={loading}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={handleSend}
                className="button button-primary"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={handleSaveDraft}
                className="button button-secondary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleCancel}
                className="button"
                style={{ background: '#e0e0e0' }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Compose
