# Notification Soft Deletion Implementation (Fixed)

## What was wrong?
- The initial update to the `DELETE` route failed, resulting in duplicate code blocks: one with the new logic, and one with the old logic that returned `403 Forbidden` for system broadcasts.
- Because of this, users were still seeing "Cannot delete system broadcasts" when trying to delete them.

## What was fixed?
- **Route Cleanup:** Removed the duplicate legacy code block in `backend/routes/notifications.js`.
- **Logic Confirmation:** The route now correctly uses the soft-deletion logic (setting `isDeleted: true` in `NotificationRead`) for ALL notification types.

## Result
Users can now delete any notification from their view without error.
