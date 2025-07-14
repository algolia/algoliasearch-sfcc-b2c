const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Makes an HTTPS request
 * @param {string} url - URL to request
 * @param {object} options - Request options
 * @param {Buffer|string} data - Request body
 * @returns {Promise<object>} Response data
 */
function httpsRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${responseData}`));
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(data);
        }
        req.end();
    });
}

/**
 * Uploads a file to Slack using multipart form data
 * @param {string} filePath - Path to the file to upload
 * @param {string} token - Slack bot token
 * @param {string} channel - Slack channel ID
 * @param {string} title - Title for the file
 * @param {string} comment - Initial comment for the file
 */
async function uploadFileToSlack(filePath, token, channel, title, comment) {
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="channels"\r\n\r\n`;
    body += `${channel}\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="title"\r\n\r\n`;
    body += `${title}\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="initial_comment"\r\n\r\n`;
    body += `${comment}\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: ${fileName.endsWith('.png') ? 'image/png' : 'video/mp4'}\r\n\r\n`;
    
    const bodyStart = Buffer.from(body, 'utf8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const bodyBuffer = Buffer.concat([bodyStart, fileContent, bodyEnd]);

    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length
        }
    };

    const result = await httpsRequest('https://slack.com/api/files.upload', options, bodyBuffer);
    
    if (!result.ok) {
        throw new Error(`Slack upload failed: ${result.error}`);
    }
    return result;
}

/**
 * Sends a message to Slack
 * @param {string} token - Slack bot token
 * @param {string} channel - Slack channel ID
 * @param {string} text - Message text
 * @param {Array} blocks - Slack blocks for rich formatting
 */
async function sendSlackMessage(token, channel, text, blocks = []) {
    const data = JSON.stringify({
        channel,
        text,
        blocks,
    });

    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const result = await httpsRequest('https://slack.com/api/chat.postMessage', options, data);
    
    if (!result.ok) {
        throw new Error(`Slack message failed: ${result.error}`);
    }
    return result;
}

/**
 * Main function to handle test failure notifications
 */
async function notifyTestFailure() {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_CHANNEL_ID;
    
    if (!token) {
        console.error('SLACK_BOT_TOKEN not set, skipping Slack notification');
        return;
    }
    
    if (!channel) {
        console.error('SLACK_CHANNEL_ID not set, skipping Slack notification');
        return;
    }

    const screenshotsDir = path.join(process.cwd(), 'cypress/screenshots');
    const videosDir = path.join(process.cwd(), 'cypress/videos');
    
    // Prepare the failure message
    const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    const prNumber = process.env.GITHUB_REF?.match(/pull\/(\d+)/)?.[1];
    const prUrl = prNumber ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/pull/${prNumber}` : null;
    
    const blocks = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '🚨 E2E Tests Failed',
                emoji: true
            }
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Repository:*\n${process.env.GITHUB_REPOSITORY}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Branch:*\n${process.env.GITHUB_REF_NAME}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Commit:*\n${process.env.GITHUB_SHA?.substring(0, 7)}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Run:*\n<${runUrl}|View Run>`
                }
            ]
        }
    ];

    if (prUrl) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Pull Request:* <${prUrl}|#${prNumber}>`
            }
        });
    }

    try {
        // Send initial message
        await sendSlackMessage(token, channel, 'E2E Tests Failed - Screenshots incoming...', blocks);

        // Upload screenshots
        if (fs.existsSync(screenshotsDir)) {
            const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
            
            for (const screenshot of screenshots) {
                const filePath = path.join(screenshotsDir, screenshot);
                const isFailure = screenshot.includes('failed-');
                
                if (isFailure) {
                    console.log(`Uploading screenshot: ${screenshot}`);
                    await uploadFileToSlack(
                        filePath,
                        token,
                        channel,
                        screenshot,
                        `Failed test screenshot from run ${process.env.GITHUB_RUN_ID}`
                    );
                }
            }
        }

        // Upload videos if they exist and are small enough (Slack has a 50MB limit)
        if (fs.existsSync(videosDir)) {
            const videos = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4'));
            
            for (const video of videos) {
                const filePath = path.join(videosDir, video);
                const stats = fs.statSync(filePath);
                
                // Only upload videos smaller than 50MB
                if (stats.size < 50 * 1024 * 1024) {
                    console.log(`Uploading video: ${video}`);
                    await uploadFileToSlack(
                        filePath,
                        token,
                        channel,
                        video,
                        `Test video from run ${process.env.GITHUB_RUN_ID}`
                    );
                } else {
                    console.log(`Skipping video ${video} - too large (${stats.size} bytes)`);
                }
            }
        }

        // Send summary message
        const summaryBlocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `✅ Screenshots and videos have been uploaded. Please review the failures above.`
                }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'View GitHub Actions Run',
                            emoji: true
                        },
                        url: runUrl,
                        style: 'primary'
                    }
                ]
            }
        ];

        await sendSlackMessage(token, channel, 'Test failure artifacts uploaded', summaryBlocks);

    } catch (error) {
        console.error('Failed to send Slack notification:', error);
        // Don't fail the workflow if Slack notification fails
    }
}

// Run if called directly
if (require.main === module) {
    notifyTestFailure().catch(console.error);
}

module.exports = { uploadFileToSlack, sendSlackMessage, notifyTestFailure };