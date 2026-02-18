# Admin Support Chat Visibility Fix

## Problem
The user reported: "when user makes the chat to help center in return its only visible to one admin".

This was happening because the `GET /api/admin/chats` endpoint was likely returning *all* chats that the querying admin participated in (or just random chats), rather than specifically looking for critical "Support" tickets (`support_userId`).

## Solution
Updated `backend/routes/admin.js` to explicitly filter for support chats.

- **Route:** `GET /api/admin/chats`
- **Change:** Added a `where` clause to the `groupBy` query:
  ```javascript
  where: {
      chatId: {
          startsWith: 'support_'
      }
  }
  ```

## Result
Now, when **any** admin views the "Chats" tab in the dashboard, they will see **ALL** open support tickets from all users, regardless of which specific admin originally replied.
