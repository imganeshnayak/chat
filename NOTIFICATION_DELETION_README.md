# Notification Deletion Implemented

## Changes
1.  **Backend (`backend/routes/notifications.js`):**
    -   Added `DELETE /api/notifications/:id`.
    -   Users can delete personal notifications.
    -   Global broadcasts cannot be deleted (returns 403 Forbidden).

2.  **Frontend (`frontend/src/lib/api.ts`):**
    -   Added `deleteNotification(id)`.

3.  **UI (`frontend/src/components/NotificationBell.tsx`):**
    -   Added a Trash icon (only visible on hover).
    -   Implemented optimistic `handleDelete`.
    -   Shows error toast if unable to delete (e.g., system broadcast).
