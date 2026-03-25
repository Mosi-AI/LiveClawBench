from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from models import db, User, Email, Attachment
from datetime import datetime
import os
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///email_app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'jwt-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 24 * 3600  # 24 hours
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads', 'attachments')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max request size
app.config['ALLOWED_EXTENSIONS'] = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'zip'}

# Create uploads directory
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions
db.init_app(app)
CORS(app)
jwt = JWTManager(app)


# Configure JWT to handle integer user IDs
@jwt.user_identity_loader
def user_identity_lookup(user):
    return str(user)


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return User.query.filter_by(id=int(identity)).one_or_none()

# Create database tables
with app.app_context():
    db.create_all()

    # Create mock user for auto-login if not exists
    existing_user = User.query.filter_by(username='peter').first()
    if not existing_user:
        mock_user = User(username='peter', email='peter.griffin@email.app')
        mock_user.set_password('password123')
        db.session.add(mock_user)
        db.session.commit()
        # print("Mock user created: peter / password123")


# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Email API is running'}), 200


# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        # Validate input
        if not all([username, email, password]):
            return jsonify({'error': 'Missing required fields'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        # Create new user
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        # Generate access token
        access_token = create_access_token(identity=user.id)

        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(),
            'access_token': access_token
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user and return JWT token"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        # Validate input
        if not all([username, password]):
            return jsonify({'error': 'Missing credentials'}), 400

        # Find user
        user = User.query.filter_by(username=username).first()

        # Check credentials
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid username or password'}), 401

        # Generate access token
        access_token = create_access_token(identity=user.id)

        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({'user': user.to_dict()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Attachment endpoints
@app.route('/api/attachments/upload', methods=['POST'])
@jwt_required()
def upload_attachment():
    """Upload attachment file(s)"""
    try:
        user_id = get_jwt_identity()

        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No files selected'}), 400

        # Calculate total size
        total_size = sum(len(f.read()) for f in files)
        for f in files:
            f.stream.seek(0)  # Reset file pointer after reading

        if total_size > 10 * 1024 * 1024:
            return jsonify({'error': 'Total attachment size exceeds 10MB limit'}), 413

        uploaded_attachments = []
        date_folder = datetime.utcnow().strftime('%Y-%m-%d')
        upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], date_folder)
        os.makedirs(upload_dir, exist_ok=True)

        for file in files:
            if file.filename == '':
                continue

            # Get file size before saving
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset to beginning

            # Secure filename and generate UUID
            original_filename = secure_filename(file.filename)
            file_ext = os.path.splitext(original_filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = os.path.join(date_folder, unique_filename)

            # Save file
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], file_path))

            # Create attachment record
            attachment = Attachment(
                filename=unique_filename,
                original_filename=original_filename,
                file_path=file_path,
                file_size=file_size,
                mime_type=file.content_type or 'application/octet-stream'
            )
            db.session.add(attachment)
            uploaded_attachments.append(attachment)

        db.session.commit()

        return jsonify({
            'message': 'Attachments uploaded successfully',
            'attachments': [att.to_dict() for att in uploaded_attachments]
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/attachments/<int:attachment_id>/download', methods=['GET'])
@jwt_required()
def download_attachment(attachment_id):
    """Download attachment file"""
    try:
        user_id = int(get_jwt_identity())
        attachment = Attachment.query.get_or_404(attachment_id)

        # Check if user has access (is sender or recipient of the email)
        if attachment.email_id:
            email = Email.query.get(attachment.email_id)
            if not email or (email.sender_id != user_id and email.recipient_id != user_id):
                return jsonify({'error': 'Access denied'}), 403
        else:
            # Orphaned attachment - only allow uploader to download
            return jsonify({'error': 'Attachment not linked to any email'}), 404

        # Send file
        from flask import send_from_directory
        return send_from_directory(
            app.config['UPLOAD_FOLDER'],
            attachment.file_path,
            as_attachment=True,
            download_name=attachment.original_filename
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/attachments/<int:attachment_id>', methods=['DELETE'])
@jwt_required()
def delete_attachment(attachment_id):
    """Delete an attachment (only if not yet sent)"""
    try:
        user_id = int(get_jwt_identity())
        attachment = Attachment.query.get_or_404(attachment_id)

        # Check if attachment is linked to an email
        if attachment.email_id:
            email = Email.query.get(attachment.email_id)
            # Only allow deletion if email is still a draft and user owns it
            if not email or email.folder != 'drafts' or email.sender_id != user_id:
                return jsonify({'error': 'Cannot delete attachment from sent email'}), 403

        # Delete file from disk
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], attachment.file_path))
        except OSError:
            pass  # File already deleted or doesn't exist

        db.session.delete(attachment)
        db.session.commit()

        return jsonify({'message': 'Attachment deleted'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Email endpoints
@app.route('/api/emails', methods=['GET'])
@jwt_required()
def get_emails():
    """Get emails for current user, optionally filtered by folder"""
    try:
        user_id = int(get_jwt_identity())
        folder = request.args.get('folder', 'inbox')

        # Query emails based on folder
        if folder == 'inbox':
            emails = Email.query.filter_by(recipient_id=user_id, folder='inbox').order_by(
                Email.created_at.desc()).all()
        elif folder == 'sent':
            emails = Email.query.filter_by(sender_id=user_id, folder='sent').order_by(
                Email.created_at.desc()).all()
        elif folder == 'drafts':
            emails = Email.query.filter_by(sender_id=user_id, folder='drafts').order_by(
                Email.updated_at.desc()).all()
        elif folder == 'trash':
            emails = Email.query.filter(
                ((Email.sender_id == user_id) | (Email.recipient_id == user_id)) & (Email.folder == 'trash')
            ).order_by(Email.created_at.desc()).all()
        else:
            return jsonify({'error': 'Invalid folder'}), 400

        return jsonify({
            'emails': [email.to_dict() for email in emails],
            'count': len(emails)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/emails/<int:email_id>', methods=['GET'])
@jwt_required()
def get_email(email_id):
    """Get a specific email by ID"""
    try:
        user_id = int(get_jwt_identity())
        email = Email.query.get_or_404(email_id)

        # Check if user has access to this email
        if email.sender_id != user_id and email.recipient_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        return jsonify({'email': email.to_dict()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/emails', methods=['POST'])
@jwt_required()
def create_email():
    """Create a new email or save as draft"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()

        recipient_email = data.get('recipient')
        subject = data.get('subject', '')
        body = data.get('body', '')
        send_now = data.get('send_now', False)
        attachment_ids = data.get('attachment_ids', [])

        # Validate required fields
        if not recipient_email:
            return jsonify({'error': 'Recipient is required'}), 400

        # Find recipient user (optional - allow external emails)
        recipient = User.query.filter_by(email=recipient_email).first()

        # Validate attachment IDs exist
        attachments = []
        if attachment_ids:
            attachments = Attachment.query.filter(Attachment.id.in_(attachment_ids)).all()
            if len(attachments) != len(attachment_ids):
                return jsonify({'error': 'One or more attachments not found'}), 404

        # Determine folder based on whether we're sending or saving as draft
        folder = 'sent' if send_now else 'drafts'

        # Create new email
        email = Email(
            sender_id=user_id,
            recipient_id=recipient.id if recipient else None,
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            folder=folder
        )
        db.session.add(email)
        db.session.flush()  # Flush to get email.id

        # Link attachments to email
        for attachment in attachments:
            attachment.email_id = email.id

        # If sending now and recipient exists in system, also add to recipient's inbox
        if send_now and recipient:
            recipient_inbox_email = Email(
                sender_id=user_id,
                recipient_id=recipient.id,
                recipient_email=recipient_email,
                subject=subject,
                body=body,
                folder='inbox'
            )
            db.session.add(recipient_inbox_email)
            db.session.flush()  # Flush to get recipient_inbox_email.id

            # Duplicate attachment records for recipient's copy
            for attachment in attachments:
                recipient_attachment = Attachment(
                    email_id=recipient_inbox_email.id,
                    filename=attachment.filename,
                    original_filename=attachment.original_filename,
                    file_path=attachment.file_path,
                    file_size=attachment.file_size,
                    mime_type=attachment.mime_type
                )
                db.session.add(recipient_attachment)

        db.session.commit()

        return jsonify({
            'message': 'Email saved successfully' if not send_now else 'Email sent successfully',
            'email': email.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/emails/<int:email_id>', methods=['PUT'])
@jwt_required()
def update_email(email_id):
    """Update an existing email (primarily for drafts)"""
    try:
        user_id = int(get_jwt_identity())
        email = Email.query.get_or_404(email_id)

        # Check if user owns this email
        if email.sender_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()

        # Only allow updating drafts
        if email.folder != 'drafts':
            return jsonify({'error': 'Only drafts can be updated'}), 400

        # Update fields
        if 'recipient' in data:
            recipient = User.query.filter_by(email=data['recipient']).first()
            email.recipient_id = recipient.id if recipient else None
            email.recipient_email = data['recipient']

        if 'subject' in data:
            email.subject = data['subject']
        if 'body' in data:
            email.body = data['body']

        # Update attachments if provided
        if 'attachment_ids' in data:
            attachment_ids = data.get('attachment_ids', [])
            attachments = Attachment.query.filter(Attachment.id.in_(attachment_ids)).all()

            # Unlink existing attachments
            for att in email.attachments:
                att.email_id = None

            # Link new attachments
            for attachment in attachments:
                attachment.email_id = email.id

        email.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Email updated successfully',
            'email': email.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/emails/<int:email_id>', methods=['DELETE'])
@jwt_required()
def delete_email(email_id):
    """Delete an email or move to trash"""
    try:
        user_id = int(get_jwt_identity())
        email = Email.query.get_or_404(email_id)

        # Check if user has access to this email
        if email.sender_id != user_id and email.recipient_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        # Move to trash if not already there
        if email.folder != 'trash':
            email.folder = 'trash'
            db.session.commit()
            return jsonify({
                'message': 'Email moved to trash',
                'email': email.to_dict()
            }), 200

        # Permanently delete if already in trash
        db.session.delete(email)
        db.session.commit()

        return jsonify({'message': 'Email deleted permanently'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/emails/<int:email_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(email_id):
    """Mark an email as read or unread"""
    try:
        user_id = int(get_jwt_identity())
        email = Email.query.get_or_404(email_id)

        # Check if user has access to this email
        if email.recipient_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        is_read = data.get('is_read', True)

        email.is_read = is_read
        db.session.commit()

        return jsonify({
            'message': 'Email status updated',
            'email': email.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/emails/<int:email_id>/send', methods=['PUT'])
@jwt_required()
def send_draft(email_id):
    """Send a draft email"""
    try:
        user_id = int(get_jwt_identity())
        email = Email.query.get_or_404(email_id)

        # Check if user owns this draft
        if email.sender_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        # Check if it's a draft
        if email.folder != 'drafts':
            return jsonify({'error': 'Only drafts can be sent'}), 400

        # Move to sent folder
        email.folder = 'sent'

        # Get attachments from the draft
        attachments = list(email.attachments)

        # Add to recipient's inbox (only if recipient exists in system)
        if email.recipient_id:
            recipient_inbox_email = Email(
                sender_id=email.sender_id,
                recipient_id=email.recipient_id,
                recipient_email=email.recipient_email,
                subject=email.subject,
                body=email.body,
                folder='inbox'
            )
            db.session.add(recipient_inbox_email)
            db.session.flush()  # Flush to get recipient_inbox_email.id

            # Duplicate attachment records for recipient's copy
            for attachment in attachments:
                recipient_attachment = Attachment(
                    email_id=recipient_inbox_email.id,
                    filename=attachment.filename,
                    original_filename=attachment.original_filename,
                    file_path=attachment.file_path,
                    file_size=attachment.file_size,
                    mime_type=attachment.mime_type
                )
                db.session.add(recipient_attachment)

        db.session.commit()

        return jsonify({
            'message': 'Email sent successfully',
            'email': email.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search for users by username or email"""
    try:
        query = request.args.get('q', '').strip()

        if not query:
            return jsonify({'users': []}), 200

        users = User.query.filter(
            (User.username.ilike(f'%{query}%')) |
            (User.email.ilike(f'%{query}%'))
        ).limit(10).all()

        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
