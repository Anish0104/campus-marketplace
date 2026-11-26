# Notifications

Signed-in users get a notification when someone sends them a chat message. The bell in the shared header shows how many notifications are unread. Selecting an unread alert marks it as read and opens the conversation. The Messages badge continues to count unread conversations.

## How it works

1. The [chat route](../server/src/routes/conversations.ts) saves the message and creates a `new_message` notification for the other participant. The alert includes the listing title and links to `/messages?c=<conversationId>`.
2. The [Notification model](../server/src/models/Notification.ts) stores the recipient, event type, display text, in-app link, read flag, and timestamps in MongoDB. Alerts start unread. Indexes support the newest-first list and unread count.
3. After saving the alert, the server emits `notification:new` to the recipient’s Socket.IO room. The [bell](../client/src/components/NotificationBell.tsx) reloads the list and count on that event, on socket connection, and when the browser window regains focus.

If saving the alert fails after the message is saved, the server logs the failure and still returns a successful message response. This avoids prompting the sender to retry a message that already went through.

## API

All endpoints require a signed-in session and scope their database operations to the current user.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/notifications` | Returns up to 50 recent alerts, newest first. |
| `GET /api/notifications/unread-count` | Returns `{ count }` across all of the user’s unread alerts. |
| `PATCH /api/notifications/:id/read` | Marks the user’s alert as read and returns the updated alert. A missing alert or one owned by another user returns `404`. |

## Testing

Anand confirmed the flow in the browser. To repeat it locally, sign in as two different users in separate browser sessions and send a message about a listing. The recipient’s bell should update without a page refresh. Clicking the alert should open the conversation and reduce the unread count by one.

The [integration test](../server/tests/conversations.test.ts) verifies that only the recipient gets the alert, the sender cannot mark it as read, and marking it as read drops the recipient’s unread count from one to zero. The chat integration suite, server and client TypeScript checks, and frontend lint passed.

## Follow-up

The model also defines `flagged` and `removed` event types. Connecting moderation resolutions and seller-driven listing status changes is future work.
