# ChatPay — Client-Vendor Chat & Escrow Platform (Frontend)

## Design System

- **Theme**: Dark & warm — deep charcoal/slate backgrounds (#1A1A2E, #16213E) with warm accent colors (amber #F59E0B, coral #F97316, teal #14B8A6)
- **No gradients, no glass/prism effects** — flat, clean, solid colors with subtle shadows
- **Mobile-first responsive design** throughout

---

## Pages & Features

### 1. Landing Page

- Hero section with app tagline and value proposition for freelancers/clients
- Feature highlights (real-time chat, escrow payments, media sharing, profile sharing)
- CTA buttons to Register / Login
- Footer with links

### 2. Login Page

- Telegram-style login UI (phone number input with country code)
- Email/password login option
- "Sign up" link
- *Note: Actual Telegram OAuth will be added when backend is connected*

### 3. Register Page

- only telegram registraation

### 4. Chat Page (WhatsApp-style)

- **Left panel**: Conversation list with search, unread badges, last message preview, timestamps
- **Right panel**: Active chat with message bubbles, timestamps, read receipts
- **Message types**: Text, images, documents, voice notes (send media via attachment button)
- **Chat header**: Contact name, avatar, online status, profile link
- **Chat input**: Text field, emoji picker, attachment button (photos, files), send button
- On mobile: conversation list is full screen, tapping a chat opens full-screen chat view with back button

### 5. User Profile Page

- Avatar, display name, bio, role (Client/Vendor), contact info
- Edit profile functionality
- **Profile sharing**: Shareable link or QR code to share your profile with others
- View other user's profile from chat

### 6. Escrow Payment Panel (within chat or dedicated section)

- Create a deal/contract: set total amount and description
- Payment status tracker showing percentage released
- Client can release payment in custom percentages (e.g., 25%, 50%, etc.)
- Transaction history per deal
- Visual progress bar showing how much has been released

### 7. Admin Dashboard

- **Chat overview**: List of all active conversations between clients and vendors
- **Chat viewer**: Admin can read any conversation (read-only)
- **Actions**: Flag/archive chats, warn users, suspend accounts
- **User management**: List of all users with roles, status
- **Payment oversight**: View all escrow deals and their status
- Sidebar navigation for admin sections

---

## Navigation

- Bottom tab bar on mobile (Chats, Contacts, Profile, Payments)
- Sidebar on desktop
- Admin has separate dashboard layout with sidebar

## Data

- All features will use mock/demo data for now
- Structured so backend (Supabase) can be plugged in later for real-time chat, auth, storage, and payments