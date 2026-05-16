# Email Application - Frontend and Backend

A simulated email application with React frontend, Flask backend, and SQLite database.

## Project Structure

```
email-app/
├── backend/           # Flask backend
│   ├── app.py        # Main Flask application
│   ├── models.py     # Database models
│   └── requirements.txt
└── frontend/         # React frontend
    ├── public/       # Static files
    ├── src/          # React components
    └── package.json
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5174`

## Features

- User registration and login with JWT authentication
- Multiple email folders: Inbox, Sent, Drafts, Trash
- Compose and send emails with attachments
- Save drafts
- Move emails to trash
- Mark emails as read/unread
- Email search functionality
- Support for external recipient email addresses

## Database Schema

### User Table
Stores user account information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique user identifier |
| username | VARCHAR(80) | UNIQUE, NOT NULL | User's username |
| email | VARCHAR(120) | UNIQUE, NOT NULL | User's email address |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| created_at | DATETIME | DEFAULT: utcnow | Account creation timestamp |

**Relationships:**
- `sent_emails`: One-to-many relationship with Email (as sender)
- `received_emails`: One-to-many relationship with Email (as recipient)

### Email Table
Stores email messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique email identifier |
| sender_id | INTEGER | FOREIGN KEY (user.id), NOT NULL | Reference to sender |
| recipient_id | INTEGER | FOREIGN KEY (user.id), NULLABLE | Reference to recipient (NULL for external) |
| recipient_email | VARCHAR(120) | NOT NULL | Recipient email address |
| subject | VARCHAR(500) | NOT NULL | Email subject line |
| body | TEXT | NOT NULL | Email body content |
| folder | VARCHAR(50) | DEFAULT: 'inbox' | Folder: inbox, sent, drafts, trash |
| is_read | BOOLEAN | DEFAULT: FALSE | Read status |
| created_at | DATETIME | DEFAULT: utcnow | Creation timestamp |
| updated_at | DATETIME | DEFAULT: utcnow, ONUPDATE: utcnow | Last update timestamp |

**Relationships:**
- `sender`: Many-to-one relationship with User (foreign_keys='sender_id')
- `recipient`: Many-to-one relationship with User (foreign_keys='recipient_id')
- `attachments`: One-to-many relationship with Attachment (cascade delete)

### Attachment Table
Stores email attachments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique attachment identifier |
| email_id | INTEGER | FOREIGN KEY (email.id), NULLABLE, ONDELETE: CASCADE | Reference to email |
| filename | VARCHAR(255) | NOT NULL | UUID filename on disk |
| original_filename | VARCHAR(255) | NOT NULL | Original user filename |
| file_path | VARCHAR(500) | NOT NULL | Relative path from uploads directory |
| file_size | INTEGER | NOT NULL | File size in bytes |
| mime_type | VARCHAR(100) | NOT NULL | MIME type of the file |
| created_at | DATETIME | DEFAULT: utcnow | Upload timestamp |

**Storage:** Files are stored in `backend/uploads/attachments/YYYY-MM-DD/` with UUID filenames for security.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Emails
- `GET /api/emails` - Get all emails for user (query param: folder)
- `GET /api/emails/<id>` - Get single email
- `POST /api/emails` - Create new email/save draft
- `PUT /api/emails/<id>` - Update email (drafts only)
- `DELETE /api/emails/<id>` - Delete email (move to trash or permanent delete)
- `PUT /api/emails/<id>/read` - Mark email as read/unread
- `PUT /api/emails/<id>/send` - Send draft email

### Attachments
- `POST /api/attachments/upload` - Upload attachment file(s)
- `GET /api/attachments/<id>/download` - Download attachment
- `DELETE /api/attachments/<id>` - Delete attachment (drafts only)

### Users
- `GET /api/users/search` - Search users by username or email

## Data Injection Scripts

The project includes data injection scripts for populating the database with test data. These scripts are located in `backend/scripts/`.

### Available Scripts:

1. **inject_basic_data.py** - Creates basic test data with users and emails
2. **inject_comprehensive_data.py** - Creates comprehensive test scenarios
3. **inject_attachments.py** - Creates emails with various attachment types

### Running the Scripts:

```bash
cd backend
python scripts/inject_basic_data.py
python scripts/inject_comprehensive_data.py
python scripts/inject_attachments.py
```

**Note:** These scripts will add data to the existing database. To start fresh, delete the database file first:
```bash
rm instance/email_app.db
```

