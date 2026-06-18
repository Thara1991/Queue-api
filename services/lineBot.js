const { Client } = require('@line/bot-sdk');

// Initialize LINE client
const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

/**
 * Send push message to a LINE user
 * @param {string} userId - LINE User ID
 * @param {string|Object} message - Message text or message object
 * @returns {Promise}
 */
const pushMessage = async (userId, message) => {
    try {
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.warn('LINE_CHANNEL_ACCESS_TOKEN not configured. Skipping LINE notification.');
            return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
        }

        if (!userId) {
            console.warn('LINE User ID not provided. Skipping LINE notification.');
            return { success: false, error: 'LINE User ID not provided' };
        }

        // If message is a string, convert to text message format
        const messageObj = typeof message === 'string' 
            ? { type: 'text', text: message }
            : message;

        await client.pushMessage(userId, messageObj);
        console.log(`Push message sent successfully to user: ${userId}`);
        return { success: true };
    } catch (error) {
        console.error('Error sending LINE push message:', error);
        // Don't throw - LINE failures shouldn't break the main flow
        return { success: false, error: error.message };
    }
};

/**
 * Send push message to multiple users
 * @param {Array<string>} userIds - Array of LINE User IDs
 * @param {string|Object} message - Message text or message object
 * @returns {Promise}
 */
const pushMessageToMultiple = async (userIds, message) => {
    try {
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.warn('LINE_CHANNEL_ACCESS_TOKEN not configured. Skipping LINE notifications.');
            return [];
        }

        const messageObj = typeof message === 'string' 
            ? { type: 'text', text: message }
            : message;

        const promises = userIds.map(userId => 
            client.pushMessage(userId, messageObj).catch(err => {
                console.error(`Failed to send to ${userId}:`, err);
                return { success: false, userId, error: err.message };
            })
        );

        const results = await Promise.allSettled(promises);
        return results;
    } catch (error) {
        console.error('Error sending LINE push messages:', error);
        return [];
    }
};

/**
 * Create a text message object
 */
const createTextMessage = (text) => ({
    type: 'text',
    text: text
});

/**
 * Create a template message for queue notifications
 */
const createQueueNotificationMessage = (patientName, queueNumber, roomName, status) => {
    let message = '';
    switch(status) {
        case 'ADD':
            message = `📋 คุณ ${patientName}\nหมายเลขคิว: ${queueNumber}\nห้อง: ${roomName}\nกรุณารอเรียกชื่อ`;
            break;
        case 'CALL':
            message = `📢 คุณ ${patientName}\nหมายเลขคิว: ${queueNumber}\nกรุณาไปที่ห้อง ${roomName} ครับ/ค่ะ`;
            break;
        case 'IN':
            message = `✅ คุณ ${patientName} เข้าห้อง ${roomName} แล้ว`;
            break;
        case 'FIN':
            message = `✓ คุณ ${patientName} รับบริการเสร็จสิ้นแล้ว\nขอบคุณที่ใช้บริการ`;
            break;
        case 'SKIP':
            message = `⏭️ คุณ ${patientName} ถูกข้ามคิว\nกรุณาติดต่อเจ้าหน้าที่`;
            break;
        case 'CANCEL':
            message = `❌ คิวของคุณ ${patientName} ถูกยกเลิก`;
            break;
        default:
            message = `หมายเลขคิว: ${queueNumber}\nห้อง: ${roomName}`;
    }
    return createTextMessage(message);
};

module.exports = {
    pushMessage,
    pushMessageToMultiple,
    createTextMessage,
    createQueueNotificationMessage
};

