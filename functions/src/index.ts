import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Cloud Function to process push notification requests
 * Triggered when a new document is created in pushNotificationRequests collection
 */
export const processPushNotifications = functions.firestore
  .document("pushNotificationRequests/{requestId}")
  .onCreate(async (snap, _context) => {
    const data = snap.data();
    
    // Skip if already processed
    if (data.processed) {
      console.log("Request already processed, skipping...");
      return;
    }

    const {title, body, audience} = data;
    
    console.log(`Processing notification request: ${title} for ${audience}`);
    
    try {
      // Get users based on audience
      let usersQuery = admin.firestore().collection("users")
        .where("fcmToken", "!=", null);
      
      if (audience === "admins") {
        usersQuery = usersQuery.where("role", "==", "admin");
      } else if (audience === "users") {
        usersQuery = usersQuery.where("role", "==", "member");
      }
      // If audience is 'all', no additional filter needed
      
      const usersSnap = await usersQuery.get();
      const tokens: string[] = [];
      
      usersSnap.forEach((doc) => {
        const token = doc.data().fcmToken;
        if (token) tokens.push(token);
      });
      
      console.log(`Found ${tokens.length} tokens to send to`);
      
      if (tokens.length === 0) {
        await snap.ref.update({
          processed: true,
          error: "No tokens found",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }
      
      // Send notifications in batches (FCM allows 500 per request)
      const batchSize = 500;
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        
        try {
          const response = await admin.messaging().sendEachForMulticast({
            tokens: batch,
            notification: {
              title,
              body,
            },
            data: {
              type: "notification",
              audience,
            },
            android: {
              priority: "high",
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
          });
          
          successCount += response.successCount;
          failureCount += response.failureCount;
          
          console.log(`Batch sent: ${response.successCount} success, ${response.failureCount} failures`);
        } catch (error) {
          console.error("Error sending notification batch:", error);
          failureCount += batch.length;
        }
      }
      
      // Update the request document as processed
      await snap.ref.update({
        processed: true,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        sentToCount: tokens.length,
        successCount,
        failureCount,
      });
      
      console.log(`Notification processing complete: ${successCount} sent, ${failureCount} failed`);
    } catch (error) {
      console.error("Error processing notification request:", error);
      
      // Mark as processed with error
      await snap.ref.update({
        processed: true,
        error: String(error),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Optional: Function to clean up old processed notification requests
 * Runs daily at midnight UTC
 */
export const cleanupOldNotificationRequests = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("UTC")
  .onRun(async (_context) => {
    const sevenDaysAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    const snapshot = await admin.firestore()
      .collection("pushNotificationRequests")
      .where("processed", "==", true)
      .where("processedAt", "<", sevenDaysAgo)
      .get();
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} old notification requests`);
  });
