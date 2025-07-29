const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');

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

    // Initialize Slack client
    const slack = new WebClient(token);

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
        await slack.chat.postMessage({
            channel,
            text: 'E2E Tests Failed - Screenshots incoming...',
            blocks
        });

        // Upload screenshots
        if (fs.existsSync(screenshotsDir)) {
            const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
            
            for (const screenshot of screenshots) {
                const filePath = path.join(screenshotsDir, screenshot);
                const isFailure = screenshot.includes('failed-');
                
                if (isFailure) {
                    console.log(`Uploading screenshot: ${screenshot}`);
                    
                    await slack.files.uploadV2({
                        channels: channel,
                        file: fs.createReadStream(filePath),
                        filename: screenshot,
                        title: screenshot,
                        initial_comment: `Failed test screenshot from run ${process.env.GITHUB_RUN_ID}`
                    });
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
                    
                    await slack.files.uploadV2({
                        channels: channel,
                        file: fs.createReadStream(filePath),
                        filename: video,
                        title: video,
                        initial_comment: `Test video from run ${process.env.GITHUB_RUN_ID}`
                    });
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

        await slack.chat.postMessage({
            channel,
            text: 'Test failure artifacts uploaded',
            blocks: summaryBlocks
        });

    } catch (error) {
        console.error('Failed to send Slack notification:', error);
        // Re-throw to ensure the workflow knows something went wrong
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    notifyTestFailure().catch(console.error);
}

module.exports = { notifyTestFailure };