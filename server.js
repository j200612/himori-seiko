const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// 靜態網頁託管
app.use(express.static(__dirname));

// GCP 初始化
const projectId = process.env.GCP_PROJECT_ID || 'himori-seiko-2006';
const firestore = new Firestore({ projectId });
const storage = new Storage({ projectId });

const bucketName = process.env.GCS_BUCKET_NAME || 'himori-seiko-2006-media';
const bucket = storage.bucket(bucketName);

// 🔍 自動檢查並建立 GCS 儲存桶
bucket.exists().then(([exists]) => {
    if (!exists) {
        bucket.create({ location: 'asia-east1' }).then(() => {
            console.log(`Bucket ${bucketName} created successfully in asia-east1.`);
        }).catch(err => console.error('Error creating bucket:', err));
    }
}).catch(err => console.error('Error checking bucket exists:', err));

// Multer 記憶體儲存設定
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ── 1. 自動注入 Seed Data ──
async function seedDatabase() {
    try {
        // A. 清空 Q&A 知識庫 (回歸乾淨空白狀態)
        const qaCol = firestore.collection('qa_database');
        const qaSnap = await qaCol.get();
        if (!qaSnap.empty) {
            console.log('🧹 偵測到舊 FAQ 條目，開始徹底抹除大谷保代資料，恢復空白狀態...');
            const batch = firestore.batch();
            qaSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log('✅ Firestore qa_database 已完全清空洗淨！');
        } else {
            console.log('🌱 Firestore qa_database 已是乾淨空白狀態。');
        }

        // B. 注入員工權限名冊 (user_roles)
        const roleCol = firestore.collection('user_roles');
        const roleSnap = await roleCol.limit(1).get();
        if (roleSnap.empty) {
            console.log('🌱 Firestore user_roles 為空，開始注入 Seed Data...');
            const seedRoles = [
                { id: 'emp101', name: '李志強', title: '工程主任 / 領隊', phone: '0923-456-789', role: 'regular', verified: true },
                { id: 'emp102', name: '張憲明', title: '拉線組長', phone: '0912-345-678', role: 'contractor', verified: false },
                { id: 'emp103', name: '王大同', title: '技術專員', phone: '0934-567-890', role: 'contractor', verified: false },
                { id: 'emp104', name: '林小新', title: '準同仁 / 線上會員', phone: '0987-654-321', role: 'member', verified: false }
            ];
            for (const item of seedRoles) {
                await roleCol.doc(item.phone).set(item);
            }
            console.log('✅ user_roles Seed Data 注入成功！');
        }
    } catch (e) {
        console.error('Seed database error:', e);
    }
}

seedDatabase();


// ── 2. Firestore API ──

// FAQ 讀取
app.get('/api/firestore/qa', async (req, res) => {
    try {
        const snap = await firestore.collection('qa_database').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 新增/修改
app.post('/api/firestore/qa', async (req, res) => {
    try {
        const item = req.body;
        if (!item.id) item.id = 'qa_' + Date.now();
        item.time = new Date().toISOString().substring(0, 10);
        await firestore.collection('qa_database').doc(item.id).set(item);
        res.json({ success: true, item });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 刪除
app.delete('/api/firestore/qa/:id', async (req, res) => {
    try {
        await firestore.collection('qa_database').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 一鍵清空 API
app.post('/api/firestore/qa/clear', async (req, res) => {
    try {
        const snap = await firestore.collection('qa_database').get();
        const batch = firestore.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 員工權限對齊名冊讀取
app.get('/api/firestore/user-roles', async (req, res) => {
    try {
        const snap = await firestore.collection('user_roles').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 手動開通/取消認證
app.post('/api/firestore/user-roles/verify', async (req, res) => {
    try {
        const { phone, verified } = req.body;
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// 靜態網頁託管
app.use(express.static(__dirname));

// GCP 初始化
const projectId = process.env.GCP_PROJECT_ID || 'himori-seiko-2006';
const firestore = new Firestore({ projectId });
const storage = new Storage({ projectId });

const bucketName = process.env.GCS_BUCKET_NAME || 'himori-seiko-2006-media';
const bucket = storage.bucket(bucketName);

// 🔍 自動檢查並建立 GCS 儲存桶
bucket.exists().then(([exists]) => {
    if (!exists) {
        bucket.create({ location: 'asia-east1' }).then(() => {
            console.log(`Bucket ${bucketName} created successfully in asia-east1.`);
        }).catch(err => console.error('Error creating bucket:', err));
    }
}).catch(err => console.error('Error checking bucket exists:', err));

// Multer 記憶體儲存設定
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ── 1. 自動注入 Seed Data ──
async function seedDatabase() {
    try {
        // A. 清空 Q&A 知識庫 (回歸乾淨空白狀態)
        const qaCol = firestore.collection('qa_database');
        const qaSnap = await qaCol.get();
        if (!qaSnap.empty) {
            console.log('🧹 偵測到舊 FAQ 條目，開始徹底抹除大谷保代資料，恢復空白狀態...');
            const batch = firestore.batch();
            qaSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log('✅ Firestore qa_database 已完全清空洗淨！');
        } else {
            console.log('🌱 Firestore qa_database 已是乾淨空白狀態。');
        }

        // B. 注入員工權限名冊 (user_roles)
        const roleCol = firestore.collection('user_roles');
        const roleSnap = await roleCol.limit(1).get();
        if (roleSnap.empty) {
            console.log('🌱 Firestore user_roles 為空，開始注入 Seed Data...');
            const seedRoles = [
                { id: 'emp101', name: '李志強', title: '工程主任 / 領隊', phone: '0923-456-789', role: 'regular', verified: true },
                { id: 'emp102', name: '張憲明', title: '拉線組長', phone: '0912-345-678', role: 'contractor', verified: false },
                { id: 'emp103', name: '王大同', title: '技術專員', phone: '0934-567-890', role: 'contractor', verified: false },
                { id: 'emp104', name: '林小新', title: '準同仁 / 線上會員', phone: '0987-654-321', role: 'member', verified: false }
            ];
            for (const item of seedRoles) {
                await roleCol.doc(item.phone).set(item);
            }
            console.log('✅ user_roles Seed Data 注入成功！');
        }
    } catch (e) {
        console.error('Seed database error:', e);
    }
}

seedDatabase();


// ── 2. Firestore API ──

// FAQ 讀取
app.get('/api/firestore/qa', async (req, res) => {
    try {
        const snap = await firestore.collection('qa_database').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 新增/修改
app.post('/api/firestore/qa', async (req, res) => {
    try {
        const item = req.body;
        if (!item.id) item.id = 'qa_' + Date.now();
        item.time = new Date().toISOString().substring(0, 10);
        await firestore.collection('qa_database').doc(item.id).set(item);
        res.json({ success: true, item });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 刪除
app.delete('/api/firestore/qa/:id', async (req, res) => {
    try {
        await firestore.collection('qa_database').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 一鍵清空 API
app.post('/api/firestore/qa/clear', async (req, res) => {
    try {
        const snap = await firestore.collection('qa_database').get();
        const batch = firestore.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 員工權限對齊名冊讀取
app.get('/api/firestore/user-roles', async (req, res) => {
    try {
        const snap = await firestore.collection('user_roles').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 手動開通/取消認證
app.post('/api/firestore/user-roles/verify', async (req, res) => {
    try {
        const { phone, verified } = req.body;
        const ref = firestore.collection('user_roles').doc(phone);
        const doc = await ref.get();
        if (doc.exists) {
            await ref.update({ verified: !!verified });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User phone not found in roster.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// 員工權限名冊更新
app.post('/api/firestore/user-roles/update', async (req, res) => {
    try {
        const item = req.body;
        if (!item.phone) {
            return res.status(400).json({ error: 'Missing phone parameter' });
        }
        await firestore.collection('user_roles').doc(item.phone).set(item, { merge: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



// 清空收件匣
app.post('/api/inbox-media/clear', async (req, res) => {
    try {
        const snap = await firestore.collection('inbox_media').get();
        const batch = firestore.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── 6. 實體 LINE Webhook 整合與安全簽章驗證 ──
const crypto = require('crypto');
const https = require('https');

let cachedToken = null;
let tokenExpiry = 0;

async function getLineAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) {
        return cachedToken;
    }
    const channelId = process.env.LINE_CHANNEL_ID || '2010235006';
    const channelSecret = process.env.LINE_CHANNEL_SECRET || 'fd39f1d853b48d294ce823a1082a3fb1';
    
    return new Promise((resolve, reject) => {
        const tokenParams = `grant_type=client_credentials&client_id=${channelId}&client_secret=${channelSecret}`;
        const options = {
            hostname: 'api.line.me',
            path: '/v2/oauth/accessToken',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        cachedToken = parsed.access_token;
                        tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
                        resolve(cachedToken);
                    } else {
                        reject(new Error(data));
                    }
                } catch(e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(tokenParams);
        req.end();
    });
}

async function replyLineMessage(replyToken, text) {
    const accessToken = await getLineAccessToken();
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            replyToken: replyToken,
            messages: [{ type: 'text', text: text }]
        });
        const options = {
            hostname: 'api.line.me',
            path: '/v2/bot/message/reply',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve(data);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function verifyLineSignature(req, res, next) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET || 'fd39f1d853b48d294ce823a1082a3fb1';
    const signature = req.headers['x-line-signature'];
    
    if (!signature) {
        return res.status(401).send('Missing signature');
    }
    
    const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(req.rawBody || Buffer.from(''))
        .digest('base64');
        
    if (hash !== signature) {
        console.warn('LINE signature verification failed!');
        return res.status(401).send('Invalid signature');
    }
    next();
}

app.post('/api/line/webhook', verifyLineSignature, async (req, res) => {
    try {
        const events = req.body.events || [];
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userId = event.source.userId;
                const replyToken = event.replyToken;
                const userText = event.message.text.trim();
                
                if (replyToken === '00000000000000000000000000000000' || replyToken === 'ffffffffffffffffffffffffffffffff') {
                    console.log('LINE Webhook verification check event received.');
                    continue;
                }
                
                const ref = firestore.collection('line_chats').doc(userId);
                const doc = await ref.get();
                let chat;
                if (!doc.exists) {
                    chat = {
                        id: userId,
                        name: `訪客 (${userId.substring(0, 6)})`,
                        phone: '—',
                        role: 'guest',
                        status: 'AI 自動回覆中',
                        history: []
                    };
                } else {
                    chat = doc.data();
                }
                
                chat.history.push({ sender: 'user', text: userText });
                
                let aiReply = '';
                if (userText === '🔑 綁定手機 ✖ 註冊日森會員（入職領證通道）' || userText === 'auth') {
                    aiReply = `歡迎使用日森精工數位客服平台！\n👉 請點擊以下連結進行手機綁定與身分註冊：\nhttps://himori-portal-650268834354.asia-east1.run.app/modules/02_LINE_Office/line_hub/line_hub.html?userId=${userId}`;
                } else if (userText === '🏢 日森精工 官方網站') {
                    aiReply = '日森精工有限公司 官方入口：\nhttps://himori-portal-650268834354.asia-east1.run.app';
                } else if (userText === '💬 聯絡真人 雲端客服' || userText === '真人接管') {
                    chat.status = '🚨 待真人接管';
                    aiReply = '已為您通知日森工務真人客服，我們將儘速接入與您對話，請稍候...';
                } else if (userText === '今日排班') {
                    if (chat.phone !== '—') {
                        aiReply = `🤖 日森精工 | 今日排班資訊：\n工作案場：台積電F20\n施工分區：6S整理整頓\n領隊：李志強\n出勤日期：2026-06-28`;
                    } else {
                        aiReply = '您目前尚未進行身份認證，請先點選選單中的「🔑 認證開通」綁定手機。';
                    }
                } else {
                    const qaSnap = await firestore.collection('qa_database').get();
                    let kbContent = '';
                    qaSnap.forEach(qDoc => {
                        const data = qDoc.data();
                        kbContent += `Q: ${data.question}\nA: ${data.answer}\n關鍵字: ${data.keywords}\n\n`;
                    });
                    
                    const prompt = `你是一個專為日森精工 (Himori Seiko) 設計的官方帳號智能客服助理大腦。
請嚴格且誠實地依據下方提供的【知識庫內容】回答使用者的問題。

【知識庫內容】：
${kbContent}

【使用者問題】：
${userText}

【答覆規則】：
1. 你的回答必須專業、親切、簡短，且「完全依據知識庫」回答。
2. 🚨【核心信心防線】：如果在知識庫內容中，找不到答案，或者相似度信心不足（例如問非本公司業務、外來業務或計算非 FAQ 設定之保費等），請【絕對不要】編造答案！你必須在回答的最前方加上 "[LOW_CONFIDENCE]" 標記，其後回答 "抱歉，我不確定這個問題的答案。已經為您通知真人客服接管，請稍候..." 即可。`;

                    const apiKey = process.env.GEMINI_API_KEY;
                    if (apiKey) {
                        try {
                            const genAI = new GoogleGenerativeAI(apiKey);
                            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                            const result = await model.generateContent(prompt);
                            aiReply = result.response.text().trim();
                        } catch (err) {
                            console.error('Gemini API call failed in webhook:', err);
                            aiReply = '[LOW_CONFIDENCE] 抱歉，我不確定這個問題的答案。已為您通知真人客服接管。';
                        }
                    } else {
                        aiReply = '[LOW_CONFIDENCE] 抱歉，我不確定這個問題的答案。已為您通知真人客服接管。';
                    }
                    
                    if (aiReply.includes('[LOW_CONFIDENCE]')) {
                        chat.status = '🚨 待真人接管';
                        aiReply = aiReply.replace('[LOW_CONFIDENCE]', '').trim();
                    } else {
                        chat.status = 'AI 自動回覆中';
                    }
                }
                
                chat.history.push({ sender: 'system', text: aiReply });
                await ref.set(chat);
                await replyLineMessage(replyToken, aiReply);
            }
        }
        res.status(200).send('OK');
    } catch (err) {
        console.error('Error in LINE Webhook handler:', err);
        res.status(500).send('Internal Server Error');
    }
});


// 啟動伺服器
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
