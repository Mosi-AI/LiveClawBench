export const PROFILE_CSS = `.profile-container { max-width: 900px; margin: 40px auto; padding: 0 20px; }
.profile-header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; margin-bottom: 30px; }
.profile-avatar { width: 100px; height: 100px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 48px; margin: 0 auto 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.profile-header h1 { font-size: 32px; margin-bottom: 10px; }
.profile-subtitle { font-size: 16px; opacity: 0.9; }
.profile-content { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.profile-section { margin-bottom: 30px; }
.profile-section h2 { font-size: 20px; color: #232F3E; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.info-item { padding: 15px; background: #f8f9fa; border-radius: 8px; }
.info-item.full-width { grid-column: 1 / -1; }
.info-item label { display: block; font-size: 13px; color: #666; margin-bottom: 8px; font-weight: 500; }
.info-value { font-size: 16px; color: #232F3E; font-weight: 500; display: flex; align-items: center; gap: 10px; }
.value-text { flex: 1; }
.edit-btn { background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.5; transition: all 0.2s; padding: 4px 8px; border-radius: 4px; }
.edit-btn:hover { opacity: 1; background: #f0f0f0; transform: scale(1.1); }
.profile-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 30px; }
.action-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 15px 20px; background: white; border: 2px solid #e0e0e0; border-radius: 8px; text-decoration: none; color: #232F3E; font-weight: 500; transition: all 0.3s; }
.action-btn:hover { border-color: #667eea; background: #f8f9ff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.15); }
.action-btn.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; }
.action-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(102,126,234,0.3); }
.action-icon { font-size: 20px; }
.payment-methods { display: flex; flex-direction: column; gap: 15px; }
.payment-item { display: flex; align-items: center; padding: 15px; background: #f8f9fa; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
.payment-item:hover { background: #fff; border-color: #667eea; transform: translateX(5px); box-shadow: 0 2px 8px rgba(102,126,234,0.15); }
.payment-icon { font-size: 32px; margin-right: 15px; }
.payment-info { flex: 1; }
.payment-type { font-size: 16px; font-weight: 600; color: #232F3E; margin-bottom: 4px; }
.payment-account { font-size: 14px; color: #666; }
.payment-arrow { font-size: 24px; color: #999; transition: transform 0.2s; }
.payment-item:hover .payment-arrow { transform: translateX(5px); color: #667eea; }
.edit-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
.edit-modal.active { display: flex; }
.edit-modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: slideIn 0.3s ease; }
.edit-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0; }
.edit-modal-title { font-size: 22px; font-weight: 600; color: #232F3E; }
.edit-modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #999; transition: color 0.2s; }
.edit-modal-close:hover { color: #333; }
.edit-modal-body { padding: 10px 0; }
.edit-field-label { font-size: 14px; color: #666; font-weight: 500; margin-bottom: 8px; }
.edit-field-input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; color: #232F3E; transition: border-color 0.2s; box-sizing: border-box; }
.edit-field-input:focus { outline: none; border-color: #667eea; }
textarea.edit-field-input { resize: vertical; min-height: 100px; }
.edit-modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
.save-btn { padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.save-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.3); }
.cancel-btn { padding: 10px 24px; background: white; color: #232F3E; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.cancel-btn:hover { background: #f5f5f5; }
.payment-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
.payment-modal.active { display: flex; }
.modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: slideIn 0.3s ease; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0; }
.modal-title { font-size: 22px; font-weight: 600; color: #232F3E; }
.modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #999; transition: color 0.2s; }
.modal-close:hover { color: #333; }
.modal-body { padding: 10px 0; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.detail-row:last-child { border-bottom: none; }
.detail-label { font-size: 14px; color: #666; font-weight: 500; }
.detail-value { font-size: 16px; color: #232F3E; font-weight: 600; }
@keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;
