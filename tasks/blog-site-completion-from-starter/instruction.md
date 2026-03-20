The stellar-db project has been set up at /workspce/environment/stellar-db. Please Read the following requirements and finish the Stellar-DB project.

# Project Requirement Document: Stellar-DB Private Blog System

---

## 1. Project Overview
Stellar-DB is a self-hosted, multi-user blog platform with SQLite database for fast performance and data portability. The system uses Astro's SSR mode with React for interactive components.

The platform supports three user roles:
- **Admin:** Full system access and user management
- **Editor:** Content management across all posts
- **User:** Personal blog management with ownership-based permissions

---

## 2. Technical Stack
- **Frontend:** Astro 4.x (SSR Mode) + React
- **Backend:** Node.js 20+
- **Database:** SQLite 3 (via `better-sqlite3`)
- **Styling:** Tailwind CSS

---

## 3. Milestones

| Milestone | Description | Priority |
| :--- | :--- | :--- |
| **M1** | System Core - Database setup, schema, environment config | High |
| **M2** | Authentication - JWT auth, role-based access control | High |
| **M3** | User Dashboard - Personal content management, profiles | High |
| **M4** | Search & UX - Full-text search, RSS feeds, SEO | Medium |

---

## 4. Functional Requirements

### 4.1 Database Schema

**Tables Required:**
- `posts` - Blog posts with title, slug, content, status (draft/published/archived), author_id, view_count, created_at, updated_at, published_at
- `users` - User accounts with username, email, password_hash, role, display_name, bio, avatar, website
- `tags` - Tags with name and slug
- `post_tags` - Junction table linking posts to tags
- `sessions` - User session tracking
- `page_views` - Analytics data
- `media` - Media file metadata
- `comments` - Post comments
- `settings` - System configuration (key-value pairs with timestamps)
- `posts_fts` - FTS5 virtual table for full-text search on posts

**Database Configuration:**
- Enable WAL mode for better concurrency
- Enable foreign key constraints (`PRAGMA foreign_keys = ON`)
- Foreign key relationships must be defined and enforced
- FTS5 sync triggers for posts (INSERT, UPDATE, DELETE)

### 4.2 Authentication System

**Password Requirements:**
- Minimum 8 characters
- Must contain at least one number
- Hashed using bcrypt with cost factor 10
- Never stored in plaintext

**User Registration:**
- Username must be unique
- Email must be unique and validated
- Duplicate usernames rejected with clear error message
- Password strength validation enforced

**JWT Authentication:**
- 7-day token expiration
- Token payload: id, username, role, exp, iat
- Signed with configurable JWT_SECRET from environment
- Expired tokens rejected
- Tokens validated on protected routes

**Role-Based Access Control:**
- Three roles: `admin`, `editor`, `user`
- Admin: Full system access
- Editor: Can manage all posts, access admin dashboard
- User: Can only manage own content, access user dashboard

### 4.3 User Dashboard

**Post Management:**
- Users see only their own posts (ownership filter)
- Create posts with draft or published status
- Edit own posts only
- Delete own posts only
- Accurate post counts per user
- Permission enforcement: users cannot edit/delete others' posts

**Profile Management:**
- Update display name
- Update bio
- Update avatar URL
- Update website URL
- Partial updates allowed
- Changes persist correctly

**Public Author Profiles:**
- Public URL: `/author/[username]`
- Display bio and avatar
- Show only published posts (drafts hidden)
- Accurate published post count
- Publicly accessible without authentication

### 4.4 Post Visibility Rules

**Draft Posts:**
- Visible to author in dashboard
- Hidden from public blog index
- Direct public access returns 404
- Author can view own drafts in dashboard

**Published Posts:**
- Visible in public blog index
- Visible on author profile
- Searchable via FTS5
- Included in RSS feed

**Archived Posts:**
- Hidden from public
- Visible to author in dashboard
- Direct public access returns 404
- Not included in search or RSS

### 4.5 Permission System

**Ownership Model:**
- All posts have `author_id` referencing users table
- Foreign key constraint enforced

**Edit Permissions:**
- Users: Can edit only their own posts
- Editors: Can edit all posts
- Admins: Can edit all posts

**Delete Permissions:**
- Users: Can delete only their own posts
- Editors: Can delete all posts
- Admins: Can delete all posts

**Enforcement:**
- Non-owners attempting edit/delete are denied
- Failed delete attempts leave post in database
- Permission checks on all post operations

### 4.6 Search Functionality

**Full-Text Search:**
- FTS5 virtual table on posts (title, content)
- Search returns ranked results
- Only published posts searchable
- Fast keyword search across all posts

### 4.7 RSS Feed

**Feed Generation:**
- Valid XML format
- RSS channel with required elements
- Each post as `<item>` with title, link, pubDate
- Only published posts included
- Sorted by publication date (newest first)
- Available at `/rss.xml` or `/feed.xml`

### 4.8 SEO Metadata

**Dynamic Meta Tags:**
- Page title includes post title
- Meta description from post excerpt
- Open Graph tags for social sharing
- Different metadata per post

### 4.9 System Settings

**Configuration Management:**
- Settings stored in key-value pairs
- Timestamps track when settings changed
- Settings persist across application restarts
- Support for blog title, description, etc.

**Environment Variables:**
- `JWT_SECRET` - Secret for signing JWT tokens
- `DATABASE_URL` - Path to SQLite database file
- Configurable database location

---

## 5. Technical Requirements

### 5.1 Database
- SQLite with WAL mode enabled
- Foreign key constraints enforced
- Proper indexing for query performance
- FTS5 for full-text search
- Triggers for FTS synchronization

### 5.2 Security
- Passwords never stored in plaintext
- Bcrypt hashing with appropriate cost
- JWT tokens with secure expiration
- Role-based access control enforced
- Ownership validation on all operations

### 5.3 Performance
- Efficient SQL queries
- Proper use of indexes
- FTS5 for fast search
- Minimal database queries per request

---

## 6. Implementation Guidelines

### 6.1 Database Setup
1. Initialize SQLite database with proper schema
2. Enable WAL mode and foreign keys
3. Create all required tables with correct columns
4. Set up FTS5 virtual table and triggers
5. Verify foreign key relationships

### 6.2 Authentication Flow
1. Implement password hashing with bcrypt
2. Create JWT token generation/validation
3. Implement role-based middleware
4. Add permission checks to routes
5. Handle token expiration

### 6.3 Dashboard Implementation
1. Build post listing with ownership filter
2. Create post CRUD operations
3. Add permission checks on edit/delete
4. Implement profile management
5. Build public author pages

### 6.4 Search & RSS
1. Set up FTS5 virtual table
2. Implement search query handling
3. Generate RSS feed XML
4. Add dynamic meta tags to pages
5. Test with various post states

---

## 7. Quality Requirements

**Database Integrity:**
- All foreign keys enforced
- No orphaned records
- Proper cascading where applicable

**Permission Enforcement:**
- No unauthorized access to content
- Ownership checks on all operations
- Role-based restrictions working correctly

**Data Consistency:**
- Settings persist correctly
- Post counts accurate
- Profile updates saved properly

**Search Accuracy:**
- FTS5 returns relevant results
- Only published posts searchable
- Results properly ranked

**Feed Validity:**
- RSS feed is valid XML
- All published posts included
- Sorted by date correctly

---

## 8. Deployment

**Environment Setup:**
1. Install Node.js 20+
2. Set environment variables (JWT_SECRET, DATABASE_URL)
3. Initialize database schema
4. Run application in production mode

---

## 9. Out of Scope

The following features are not included in this version:
- Media upload functionality
- Image optimization
- Analytics dashboard
- Backup/restore features
- Advanced post editor
- Comment system
- Multi-language support
- Content versioning
- Admin user management UI
- Bulk operations

---
